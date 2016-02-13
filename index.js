#!/usr/bin/env node

const fs = require('fs');
const jade = require('jade');
const yaml = require('yamljs');
const cons = require('better-console');
const globule = require('globule');
const yargs = require('yargs').argv;
const vfs = require('vinyl-fs');
const File = require('vinyl');
const mapStream = require('map-stream');


cons.info(`> Called script with these parameters: ${JSON.stringify(yargs)}`);



//  -- check if file or dir exists --
const doesItExist = (s) => {
  try {
    return fs.realpathSync(s);
  } catch (e) {
    // cons.error('> Error', e);
    return false;
  }
};


//  -- config opts --
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

if (!_config.localesDir) {
  cons.error(`> Error, locales dir is not defined.`);
  process.exit();
}


if (yargs.init) {
  //  -- locales --
  if (!doesItExist(`${_config.localesDir}`)) {
    cons.warn(`> Locale dir not found. Making dir now.`);
    fs.mkdirSync(`${_config.localesDir}`);
  }

  const _locales = fs.readdirSync(`${_config.localesDir}`);
  if (!_locales || _locales.length === 0) {
    cons.warn(
      `> Error, you have zero translated yaml files into ${_config.localesDir} for data loading. ` +
      `Creating them now.`
    );
    _config.langs.forEach(l => {
      cons.info(`> Creating file for ${l} in ${_config.localesDir}/${l}.yaml`);
      fs.writeFileSync(`${_config.localesDir}/${l}.yaml`, '', 'utf-8');
    });
  } else {
    cons.warn('> You already got your files for translation.');
    _config.langs.forEach(l => {
      cons.info(`> Content for ${l} is `, yaml.load(`${_config.localesDir}/${l}.yaml`));
    });
  }

  process.exit();
}


//  -- jade part --
if (yargs.testjade) {
  if (!doesItExist(_config.templateDir || `./templates`)) {
    cons.error(`> Error, you don't set a template directory with jade files in your config.`);
    process.exit();
  }

  const $t = function $t() {
    // console.log(Array.apply(null, arguments));
    //  -- usually the first argument is the text / variable string --
    return arguments[0];
  };


  const _templatesFiles = globule.find(`${(_config.templateDir || './templates')}/**/*.jade`);
  // cons.info(_templatesFiles);


  const buildJadeFile = function buildJadeFile(f, callback) {
    const html = jade.renderFile(`${f.path}`, { $t });
    // cons.info(`> file path is: ${f.path}`);
    // cons.info(`> compiled html is: ${html}`);
    const htmlFile = new File({
      contents: new Buffer(html),
      path: `${(f.path).replace('.jade', '.html')}`,
      base: `${(_config.templateDir || './templates')}`,
    });

    callback(null, htmlFile);
  };


  vfs
    .src(
      _templatesFiles, {
        base: `${(_config.templateDir || './templates')}`,
      })
    .pipe(
      mapStream(buildJadeFile)
    )
    .pipe(
      vfs.dest(
        `${(_config.outputDir || './build')}`
      )
    );
}
