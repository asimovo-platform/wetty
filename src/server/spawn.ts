import isUndefined from 'lodash/isUndefined.js';
import pty from 'node-pty';
import { logger as getLogger } from '../shared/logger.js';
import { tinybuffer, FlowControlServer } from './flowcontrol.js';
import { xterm } from './shared/xterm.js';
import { envVersionOr } from './spawn/env.js';
import type SocketIO from 'socket.io';

const kills = new Map<String, ReturnType<typeof setTimeout>>();

export async function spawn(
  socket: SocketIO.Socket,
  args: string[],
): Promise<void> {
  const logger = getLogger();

  if (socket.recovered && kills.has(socket.id)){
	clearTimeout(kills.get(socket.id));
	logger.info('Socket connection recovered, not respawning PTY.');
	return
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
  socket
    .on('resize', ({ cols, rows }) => {
      term.resize(cols, rows);
    })
    .on('input', input => {
      if (!isUndefined(term)) term.write(input);
    })
    .on('disconnect', () => {
     //delay the kill for the maxDisconnectionDuration, on new Spawn check if socket.reconnected, cancel kill. Same socket is passed, so no new listeners necessary.
      kills.set(socket.id,setTimeout(()=>{
		kills.delete(socket.id)
		term.kill();
		logger.info('Process exited', { code: 0, pid });
      }, 5000));
    })
    .on('commit', size => {
      if (fcServer.commit(size)) {
        term.resume();
      }
    });
}
