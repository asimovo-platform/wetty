import isUndefined from 'lodash/isUndefined.js';
import pty from 'node-pty';
import { logger as getLogger } from '../shared/logger.js';
import { tinybuffer, FlowControlServer } from './flowcontrol.js';
import { xterm } from './shared/xterm.js';
import { envVersionOr } from './spawn/env.js';
import type SocketIO from 'socket.io';


type LinkState = {
    term: ReturnType<typeof pty.spawn>;
    timeout: ReturnType<typeof setTimeout>;
}
const kills = new Map<string, LinkState>();

export async function spawn(
  socket: SocketIO.Socket,
  args: string[],
): Promise<void> {
  const logger = getLogger();
  const attachListeners = function (socket: SocketIO.Socket, term: pty.IPty){
	 socket
		.on('resize', ({ cols, rows }) => {
			term.resize(cols, rows);
	        })
                .on('input', input => {
			if (!isUndefined(term)) term.write(input);
		})
		.on('disconnect', () => {
			// delay the kill for the maxDisconnectionDuration, on new Spawn check if socket.reconnected, cancel kill. Same socket is passed, so no new listeners necessary.
			term.pause();
			const linkstate: LinkState = {
				term,
				timeout: setTimeout(()=>{
					kills.delete(socket.id)
					term.kill();
					logger.info('Process exited', { code: 0, pid });
				}, 60 * 1000) 
			};
			kills.set(socket.id, linkstate);
		})
		.on('commit', size => {
			if (fcServer.commit(size)) {
				term.resume();
			}
	  });
  }
  if (socket.recovered && kills.has(socket.id)){
	const linkstate = kills.get(socket.id);
	if (linkstate && linkstate.term){
		clearTimeout(linkstate.timeout);
		// Make sure our listeners are still valid (re-registering them)
                attachListeners(socket,linkstate.term)
		linkstate.term.resume()
		logger.info('Socket connection recovered, not respawning PTY.');
		return
	} 
		logger.info('Socket connection recovery failed, term invalid');
	
  }
  const version = await envVersionOr(0);
  const cmd = version >= 9 ? ['-S', ...args] : args;
  logger.debug('Spawning PTY', { cmd });
  const term = pty.spawn('/usr/bin/env', cmd, xterm);
  const { pid } = term;
  const address = args[0] === 'ssh' ? args[1] : 'localhost';
  logger.info('Process Started on behalf of user', { pid, address });
  socket.emit('login');
  term.on('exit', (code: number) => {
    logger.info('Process exited', { code, pid });
    socket.emit('logout');
    socket
      .removeAllListeners('disconnect')
      .removeAllListeners('resize')
      .removeAllListeners('input');
  });
  const send = tinybuffer(socket, 2, 524288);
  const fcServer = new FlowControlServer();
  term.on('data', (data: string) => {
    send(data);
    if (fcServer.account(data.length)) {
      term.pause();
    }
  });
  attachListeners(socket,term);
}
