const base = {
  paths: ['features/**/*.feature'],
  import: ['support/**/*.mjs', 'step-definitions/**/*.mjs'],
  format: ['progress'],
  tags: 'not @wip',
};

export default base;

// CI profile (issue #475): same run, plus junit/html written to reports/
// (gitignored; uploaded as a workflow artifact).
export const ci = {
  ...base,
  format: ['progress', 'junit:reports/junit.xml', 'html:reports/cucumber.html'],
};
