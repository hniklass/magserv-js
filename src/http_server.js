const net = require('net');
const colors = require('colors/safe');
const TCPSocket = require('./tcp_socket');

/**
 * @class
 * @classdesc HTTPServer is a custom implementation of a server to handle the HTTP protocol.
 * It implements native TCP sockets through Node's Net class.
 */
class HTTPServer {
  /**
   * @private
   * @description Holds the local IP address.
   */
  #host;

  /**
   * @private
   * @description Holds the local port number.
   */
  #port;

  /**
   * @private
   * @description Holds the dictionary for stored words.
   */
  #responses = new Map();

  /**
   * @private
   * @description Holds the server instance.
   */
  #server;

  /**
   * @private
   * @description Holds colored text to be used in console logs.
   */
  #str = {
    server: colors.yellow('[SERVER]'),
    client: colors.brightRed('[CLIENT]'),
  };

  /**
   * @function
   * @param {String} [host="127.0.0.1"] - Local address where the server will be run from.
   * @param {Number} [port=8124] - Local port where the server will be run from.
   * @returns {Object} A new HTTPServer instance.
   * @example
   * // Initializing a new server instance.
   * const server = new HTTPServer();
   * server.init();
   */
  constructor(host = '127.0.0.1', port = 8124) {
    this.#host = process.env.HOST || host;
    this.#port = process.env.PORT || port;
  }

  /**
   * @function
   * @description Closes the server connection and disconnects all sockets.
   * @returns {Void} N/A
   */
  close = () => {
    this.#server.close(() => console.log('All connections finished. Bye!'));
  }

  /**
   * @private
   * @function
   * @description This function gets called once the socket half-closes the TCP connection.
   * @param {Object} socket - The object representing the connected socket.
   * It should be passed by the appropriate event listener.
   * @return {Void} N/A
   */
  #endHandler = (socket) => {
    try {
      socket.internal.write('Finished. Bye!\r\n');
      socket.internal.destroy();
    } catch (error) {
      console.log(error);
    }

    console.log(`${this.#str.client} (${socket.addr}:${socket.port}) disconnected.`);
  }

  /**
   * @private
   * @function
   * @description Gets a previously saved word definition from the dictionary.
   * @param {String} word - The actual word stored in the dictionary.
   * @return {String} Description associated with the word key.
   * @return {Void} If no word is found, undefined is returned.
   */
  #cmdGet = (word) => this.#responses.get(word)

  /**
   * @private
   * @function
   * @description Stores a word in the dictionary.
   * @param {String} word - The word to be stored in the dictionary.
   * @param {String} desc - The description to be associated with the word.
   * @return {Object} The dictionary object.
   */
  #cmdSet = (word, desc) => this.#responses.set(word, desc)

  /**
   * @private
   * @function
   * @description Removes all words from the dictionary.
   * @return {Void} N/A
   */
  #cmdClear = () => {
    this.#responses.clear();
  }

  /**
   * @private
   * @function
   * @description Returns all words stored in the dictionary (map keys).
   * @return {String} All map keys as a string separated by pauses.
   */
  #cmdAll = () => {
    const tmpArr = Array.from(this.#responses.keys());

    return tmpArr.join(', ');
  }

  /**
   * @private
   * @function
   * @description Handles data sent by the socket to the server.
   * @param {Object} socket - The object representing the connected socket.
   * It should be passed by the appropriate event listener.
   * @param {Buffer} data - The actual data received by the socket.
   * @return {String} All map keys as a string separated by pauses.
   */
  #dataHandler = (socket, data) => {
    try {
      console.log(`${this.#str.client} (${socket.addr}:${socket.port}) sent data.`);

      const stringMatch = data.toString('utf-8').match(/[^\s]+/g);

      if (!stringMatch) {
        socket.internal.write('ERROR A command was expected.\r\n');
        return;
      }

      switch (stringMatch[0]) {
        case 'GET': {
          if (!stringMatch[1]) {
            socket.internal.write('ERROR Expected format is: GET <word>.\r\n');
            break;
          }

          const rVal = this.#cmdGet(stringMatch[1]);

          if (rVal) {
            socket.internal.write(`ANSWER ${rVal}\r\n`);
          } else {
            socket.internal.write('ERROR Could not find the specified word.\r\n');
          }
          break;
        }

        case 'SET': {
          const extraParam = stringMatch.slice(2).join(' ');

          if (!stringMatch[1] || !extraParam) {
            socket.internal.write('ERROR Expected format is: SET <word> <desc>\r\n');
            break;
          }

          this.#cmdSet(stringMatch[1], extraParam);
          socket.internal.write(`ANSWER Word ${stringMatch[1]} has been set.\r\n`);
          break;
        }

        case 'CLEAR': {
          this.#cmdClear();
          socket.internal.write('ANSWER The dictionary has been cleared.\r\n');
          break;
        }

        case 'ALL': {
          const words = this.#cmdAll();

          if (words) {
            socket.internal.write(`ANSWER Available words: ${words}.\r\n`);
          } else {
            socket.internal.write('ERROR There are no words saved.\r\n');
          }
          break;
        }

        default:
          socket.internal.write('ERROR Command not found.\r\n');
      }

      socket.internal.write('---------------\r\n');
    } catch (error) {
      console.log(
        colors.brightRed(`(${socket.addr}:${socket.port}) d/c on data listener.`),
      );
    }
  }

  /**
   * @private
   * @function
   * @description Creates a new TCPSocket instance and sets up the event listeners.
   * @param {Object} client - The object representing the connected socket.
   * It should be passed by the appropriate event listener.
   * @return {Void} N/A
   */
  #tcpHandler = (client) => {
    const socket = new TCPSocket(client);
    try {
      console.log(`${this.#str.client} (${socket.addr}:${socket.port}) connected.`);

      socket.internal.write('Successful connection.\r\n');
      socket.internal.write('Available commands: GET, SET, CLEAR, ALL.\r\n');

      socket.internal.on('end', () => this.#endHandler(socket));
      socket.internal.on('data', (data) => this.#dataHandler(socket, data));
    } catch (error) {
      console.log(
        colors.brightRed(`(${socket.addr}:${socket.port}) disconnected abruptly.`),
      );
    }
  }

  /**
   * @private
   * @function
   * @description Sets up the TCP listener for the server.
   * @return {Void} N/A
   */
  #listen = () => {
    this.#server.listen(this.#port, this.#host, 1, () => {
      console.log(`${this.#str.server} Connected. Listening on ${this.#host}:${this.#port}.`);
    });
  }

  /**
   * @function
   * @description Starts up the server.
   * @param {Function} [listener=#tcpHandler] - The callback to handle new connections.
   * @return {Object} The server instance.
   */
  init = (listener = this.#tcpHandler) => {
    console.log(colors.yellow(`Initializing TCP server on port ${this.#port}...`));

    this.#server = net.createServer({ allowHalfOpen: true }, listener);
    this.#listen();
    return this.#server;
  }
}

module.exports = { HTTPServer };
