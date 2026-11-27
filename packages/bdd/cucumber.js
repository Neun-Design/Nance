export default {
  paths: ['features/**/*.feature'],
  import: ['support/**/*.mjs', 'step-definitions/**/*.mjs'],
  format: ['progress'],
  tags: 'not @wip',
};
