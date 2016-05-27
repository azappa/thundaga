#!/usr/bin/env node

const fs = require('fs');
const pug = require('pug');
const yaml = require('yamljs');
const cons = require('better-console');
const globule = require('globule');
const yargs = require('yargs').argv;
const File = require('vinyl');
const mkdirp = require('mkdirp');
const marked = require('marked');
marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  tables: true,
  breaks: true,
  pedantic: false,
  sanitize: true,
  smartLists: true,
  smartypants: false,
});

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
if (!doesItExist('config.yaml')) {
  cons.error('> Error, you do not have a config file.');
  process.exit();
}

const _config = yaml.load('config.yaml');
cons.info(`> Your config settings are: ${JSON.stringify(_config)}`);


if (!_config.langs || _config.langs.length < 1) {
  cons.error('> Error, langs are not defined.');
  process.exit();
}

if (!_config.localesDir) {
  cons.error('> Error, locales dir is not defined.');
  process.exit();
}


if (yargs.init) {
  //  -- locales --
  if (!doesItExist(`${_config.localesDir}`)) {
    cons.warn('> Locale dir not found. Making dir now.');
    fs.mkdirSync(`${_config.localesDir}`);
  }

  const _locales = fs.readdirSync(`${_config.localesDir}`);
  if (!_locales || _locales.length === 0) {
    cons.warn(`> Error, you have zero translated yaml files into ${_config.localesDir} for data loading. Creating them now.`);
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


//  -- pug part --
if (yargs.testpug) {
  if (!doesItExist(_config.templateDir || 'templates')) {
    cons.error('> Error, you don\'t set a template directory with pug files in your config.');
    process.exit();
  }

  let currentL = _config.langs[0] || '';

  const $t = function $t(...args) {
    //  -- usually the first argument is the text / variable string --
    const params = Array.apply(null, args);
    const currentTranslations = yaml.load(`${_config.localesDir}/${currentL}.yaml`) || {};
    if (Object.keys(currentTranslations).length === 0) {
      return `Empty translation file for ${currentL}`;
    }
    // cons.info(`parameters are > ${params}, currentL is ${currentL} and currentTranslations are (below).`);
    // cons.dir(currentTranslations);

    const thisT = currentTranslations[params[0]] || `Missing translation for ${currentL} in ${currentL} yaml file.`;
    cons.info(thisT);

    if (params.length === 0) {
      return 'Cannot translate null key.';
    }

    if (params.length === 1) {
      return thisT;
    }

    switch (params[1]) {
      case 'markdown':
        return marked(thisT);
      default:
        return thisT;
    }
  };


  const _templatesFiles = globule.find(`${(_config.templateDir || 'templates')}/**/*.pug`);
  cons.info(_templatesFiles);


  const buildPugFile = (l, f) => {
    currentL = l;
    const html = pug.renderFile(`${f}`, { $t, lang: currentL });
    const htmlFile = new File({
      contents: new Buffer(html),
      path: `${(_config.outputDir || 'dist')}/${l}${(f).replace('.pug', '.html').replace(_config.templateDir || 'templates', '')}`,
      base: `${(_config.outputDir || 'dist')}`,
    });
    // cons.log(htmlFile.dirname, htmlFile.path);
    mkdirp.sync(htmlFile.dirname);
    fs.writeFileSync(htmlFile.path, htmlFile.contents, 'utf-8');
    // cons.info(htmlFile.path, htmlFile.base);
  };

  _config.langs.forEach(l => {
    _templatesFiles.forEach(f => {
      buildPugFile(l, f);
    });
  });
  cons.info('Build complete.');
}
