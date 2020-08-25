/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable } from "inversify";
import { listen as doListen, Logger, ConsoleLogger } from "vscode-ws-jsonrpc";
import { JsonRpcProxyFactory, JsonRpcProxy } from "../proxy-factory";
import { ConnectionHandler } from "../handler";
import ReconnectingWebSocket from 'reconnecting-websocket';

export interface WebSocketOptions {
    onerror?: (event: Event) => void;
}

@injectable()
export class WebSocketConnectionProvider {

    /**
     * Create a proxy object to remote interface of T type
     * over a web socket connection for the given path.
     *
     * An optional target can be provided to handle
     * notifications and requests from a remote side.
     */
    createProxy<T extends object>(path: string, target?: object, options?: WebSocketOptions): JsonRpcProxy<T> {
        const factory = new JsonRpcProxyFactory<T>(target);
        this.listen({
            path,
            onConnection: c => factory.listen(c)
        }, options);
        return factory.createProxy();
    }

    /**
     * Install a connection handler for the given path.
     */
    listen(handler: ConnectionHandler, options?: WebSocketOptions): void {
        const url = handler.path;
        const webSocket = this.createWebSocket(url, options);

        const logger = this.createLogger();
        if (options && options.onerror) {
            const onerror = options.onerror;
            webSocket.addEventListener('error', (event) => {
                onerror(event);
            });
        } else {
            webSocket.addEventListener('error', (error: Event) => {
                logger.error(JSON.stringify(error));
            });
        }
        doListen({
            webSocket,
            onConnection: connection => handler.onConnection(connection),
            logger
        });
    }

    protected createLogger(): Logger {
        return new ConsoleLogger();
    }

    /**
     * Creates a web socket for the given url
     */
    createWebSocket(url: string, options?: WebSocketOptions): WebSocket {
        const socketOptions = {
            maxReconnectionDelay: 10000,
            minReconnectionDelay: 1000,
            reconnectionDelayGrowFactor: 1.3,
            maxRetries: Infinity,
            debug: false
        };
        const result = new ReconnectingWebSocket(url, undefined, socketOptions);
        return result as any; //HACK ReconnectingWebScoket does not fully implement the WebScoket type.
    }

}