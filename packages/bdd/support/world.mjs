import { setWorldConstructor, setDefaultTimeout, World } from '@cucumber/cucumber';

setDefaultTimeout(30 * 1000);

class NanceWorld extends World {
  constructor(options) {
    super(options);
    this.engine = null; // set by the Before hook (support/hooks.mjs)
    this.apiBaseUrl = (process.env.BDD_API_URL || 'http://127.0.0.1:8777').replace(/\/$/, '');
    this.report = null;
    this.remembered = {};
    this.proc = null;
    this.comp = null;
    this.chain = null;
    this.lastResponse = null;
    this.lastBody = null;
    this.clientIp = null;
  }
}

setWorldConstructor(NanceWorld);
