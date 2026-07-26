const DOMException = globalThis.DOMException || class DOMException extends Error {
  constructor(message, name) {
    super(message);
    this.name = name || 'Error';
  }
};

module.exports = DOMException;

