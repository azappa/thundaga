#!/usr/bin/env node

const fs = require('fs');
const jade = require('jade');
const yaml = require('yamljs');
const cons = require('better-console');


const doesItExist = (s) => {
  try {
    return fs.realpathSync(s);
  } catch (e) {
    // cons.error('> Error', e);
    return false;
  }
};


if (!doesItExist(`./config.yaml`)) {
  cons.error(`> Error, you do not have a config file.`);
  process.exit();
}

const _config = yaml.load(`./config.yaml`);
cons.info(`> Your config settings are: ${JSON.stringify(_config)}`);


if (!_config.langs || _config.langs.length < 1) {
  cons.error(`> Error, langs are not defined.`);
  process.exit();
}


if (!doesItExist(`./locale`)) {
  cons.warn(`> Locale dir not found. Making dir now.`);
  fs.mkdirSync(`./locale`);
}

const _locales = fs.readdirSync(`./locale`);
if (!_locales || _locales.length === 0) {
  cons.warn(
    `> Error, you have zero translated yaml files into ./locale for data loading. ` +
    `Creating them now.`
  );
  _config.langs.forEach(l => {
    cons.info(`> Creating file for ${l} in ./locale/${l}.yaml`);
    fs.writeFileSync(`./locale/${l}.yaml`, '', 'utf-8');
  });
} else {
  cons.info('> You already got your files for translation.');
}
