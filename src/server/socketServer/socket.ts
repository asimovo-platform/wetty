import http from 'http';
import https from 'https';
import isUndefined from 'lodash/isUndefined.js';
import { Server } from 'socket.io';

import { logger } from '../../shared/logger.js';
import type { SSLBuffer } from '../../shared/interfaces.js';
import type express from 'express';

export const listen = (
  app: express.Express,
  host: string,
  port: number,
  path: string,
  { key, cert }: SSLBuffer,
): Server =>
  new Server(
    !isUndefined(key) && !isUndefined(cert)
      ? https.createServer({ key, cert }, app).listen(port, host, () => {
          logger().info('Server started', {
            port,
            connection: 'https',
          });
        })
      : http.createServer(app).listen(port, host, () => {
          logger().info('Server started', {
            port,
            connection: 'http',
          });
        }),
    {
      path: `${path}/socket.io`,
      pingInterval: 3000,
      pingTimeout: 60000,
      maxHttpBufferSize: 1e8,
      connectionStateRecovery: {
	    // the backup duration of the sessions and the packets
	    maxDisconnectionDuration: 2 * 60 * 1000,
	    // whether to skip middlewares upon successful recovery
	    skipMiddlewares: true,
      },
    },
  );
