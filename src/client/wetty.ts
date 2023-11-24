import { dom, library } from '@fortawesome/fontawesome-svg-core';
import { faCogs } from '@fortawesome/free-solid-svg-icons';
import _ from 'lodash';

import { disconnect } from './wetty/disconnect';
import { overlay } from './wetty/disconnect/elements';
import { verifyPrompt } from './wetty/disconnect/verify';
import { FileDownloader } from './wetty/download';
import { FlowControlClient } from './wetty/flowcontrol';
import { mobileKeyboard } from './wetty/mobile';
import { socket } from './wetty/socket';
import { terminal, Term } from './wetty/term';

// Setup for fontawesome
library.add(faCogs);
dom.watch();

function onResize(term: Term): () => void {
  return function resize() {
    term.resizeTerm();
  };
}

socket.on('connect', () => {
  console.log('Wetty connect event');
  const term = terminal(socket);
  if (_.isUndefined(term)) return;

  if (!_.isNull(overlay)) overlay.style.display = 'none';
  window.addEventListener('beforeunload', verifyPrompt, false);
  window.addEventListener('resize', onResize(term), false);
  window.addEventListener(
    'message',
    (event) => {
      if (event.data) {
        // if event.data starts with 'cmd:', we treat it as a command
        if (event.data.startsWith('cmd:')) {
          let cmd = event.data.replace('cmd:', '');
          console.log('command received: ', cmd);
          socket.emit('input', cmd);
        } else {
          console.log('message received: ', event.data);
        }
      }
    },
    false,
  );

  term.resizeTerm();
  term.focus();
  mobileKeyboard();
  const fileDownloader = new FileDownloader();
  const fcClient = new FlowControlClient();

  term.onData((data: string) => {
    socket.emit('input', data);
  });

  term.onResize((size: { cols: number; rows: number }) => {
    socket.emit('resize', size);
  });

  socket
    .on('data', (data: string) => {
      const remainingData = fileDownloader.buffer(data);
      const downloadLength = data.length - remainingData.length;
      if (downloadLength && fcClient.needsCommit(downloadLength)) {
        socket.emit('commit', fcClient.ackBytes);
      }
      if (remainingData) {
        if (fcClient.needsCommit(remainingData.length)) {
          term.write(remainingData, () =>
            socket.emit('commit', fcClient.ackBytes),
          );
        } else {
          term.write(remainingData);
        }
      }
    })
    .on('login', () => {
      console.log('Wetty login event');
      term.writeln('');
      term.resizeTerm();

      // notify main page that the terminal is ready
      window.parent.window.postMessage('terminal: ready', '*');
    })
    .on('logout', disconnect)
    .on('disconnect', disconnect)
    .on('error', (err: string | null) => {
      console.log('Wetty error', err);
      if (err) disconnect(err);
    });

  socket.io.on('reconnect_attempt', () => {
    console.log('Wetty manager tries to reconnect');
  });

  socket.io.on('reconnect', () => {
    console.log('Wetty manager successfully reconnected');
  });
});
