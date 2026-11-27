import { After, Before, BeforeAll } from '@cucumber/cucumber';
import { loadEngine } from './engine-loader.mjs';

let engine;
let pristine;

BeforeAll(async function () {
  engine = await loadEngine();
  // persist() is a no-op outside BLANK_MODE, so restoring is Node-safe
  pristine = engine.data.exportSnapshot();
});

Before(function () {
  this.engine = engine;
});

After({ tags: '@mutating' }, function () {
  engine.data.importSnapshot(pristine);
});
