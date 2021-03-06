#!/usr/bin/env node

const fs = require('fs');
const pug = require('pug');
const yaml = require('yamljs');
const cons = require('better-console');
const globule = require('globule');
const yargs = require('yargs').argv;
const File = require('vinyl');
const mkdirp = require('mkdirp');
const md = require('markdown-it')({ linkify: true, typographer: true, breaks: true });
const property = require('lodash.property');

cons.info(`> Called script with these parameters: ${JSON.stringify(yargs)}`);

//  -- check if file or dir exists --
const doesItExist = (s) => {
  try {
    return fs.realpathSync(s);
  } catch (e) {
    cons.error('> Error', e);
    return false;
  }
};

//  -- config opts --
if (!doesItExist('config.yaml')) {
  cons.error('Error, you do not have a config file.');
  process.exit();
}

const config = yaml.load('config.yaml');

if (config.debug) {
  cons.info(`Your config settings are: ${JSON.stringify(config, null, 2)}\n`);
}

if (!config.langs || config.langs.length < 1) {
  cons.error('Error, langs are not defined.');
  process.exit();
}

if (!config.localesDir) {
  cons.error('Error, locales dir is not defined.');
  process.exit();
}

if (yargs.init) {
  //  -- locales --
  if (!doesItExist(`${config.localesDir}`)) {
    cons.warn('Locale dir not found. Making dir now.');
    fs.mkdirSync(`${config.localesDir}`);
  }

  const locales = fs.readdirSync(`${config.localesDir}`);
  if (!locales || locales.length === 0) {
    cons.warn(`Error, you have zero translated yaml files into ${config.localesDir} for data loading. Creating them now.`);
    config.langs.forEach((l) => {
      cons.info(`> Creating file for ${l} in ${config.localesDir}/${l}.yaml`);
      fs.writeFileSync(`${config.localesDir}/${l}.yaml`, '', 'utf-8');
    });
  } else {
    cons.warn('You already got your files for translation.');
    config.langs.forEach((l) => {
      cons.info(`Content for ${l} is `, yaml.load(`${config.localesDir}/${l}.yaml`));
    });
  }

  process.exit();
}

//  -- pug part --
if (yargs.build) {
  if (!doesItExist(config.templateDir || 'templates')) {
    cons.error('> Error, you don\'t set a template directory with pug files in your config.');
    process.exit();
  }

  let currentL = config.langs[0] || '';

  const $t = function $t(...args) {
    //  -- usually the first argument is the text / variable string --
    const params = Array.apply(null, args);
    const currentTranslations = yaml.load(`${config.localesDir}/${currentL}.yaml`) || {};
    const defaultTranslations = yaml.load(`${config.localesDir}/${config.default}.yaml`) || {};

    if (Object.keys(currentTranslations).length === 0) {
      cons.warn(`Empty translation file for ${currentL}`);
      return `Empty translation file for ${currentL}`;
    }

    const thisT = property(params[0])(currentTranslations) || `${(config.showMissing
      ? `{{ default lang translation, missing the one for ${currentL} }}`
      : `{{ ${config.default} }}`)} ${property(params[0])(defaultTranslations)}` || `Missing translation for ${params[0]} in ${currentL} and ${config.default} yaml file.`;

    if (config.debug) {
      cons.info(`Translation for ${params[0]} is: ${property(params[0])(currentTranslations) || property(params[0])(defaultTranslations)}`);
    }
    if (config.debug) {
      cons.info(`Translation for ${params[0]} is: ${currentTranslations[params[0]] || defaultTranslations[params[0]]}`);
    }

    if (params.length === 0) {
      cons.warn(`Empty translation file for ${currentL}`);
      return 'Cannot translate null key.';
    }

    if (params.length === 1) {
      return thisT;
    }

    switch (params[1]) {
      case 'markdown':
        return md.render(`${thisT}`);
      default:
        return thisT;
    }
  };

  const filesToBuild = [`${(config.templateDir || 'templates')}/**/*.pug`];
  const filesToExclude = config.skipBuild && config.skipBuild.length
    ? config.skipBuild.map(f => (`!${(config.templateDir || 'templates')}/${f}`))
    : [];
  const finalFiles = filesToBuild.concat(filesToExclude);
  const templatesFiles = globule.find({ src: finalFiles });

  if (config.debug) {
    cons.info(`Files to compile are: ${templatesFiles}.\n`);
  }

  const buildPugFile = (l, f) => {
    currentL = l;
    const html = pug.renderFile(`${f}`, {
      $t, lang: currentL, langs: config.langs, defaultLang: config.default
    });
    const htmlFile = new File({
      contents: Buffer.from(html),
      path: `${(config.outputDir || 'dist')}/${l}${(f).replace('.pug', '.html').replace(config.templateDir || 'templates', '')}`,
      base: `${(config.outputDir || 'dist')}`
    });

    mkdirp.sync(htmlFile.dirname);
    fs.writeFileSync(htmlFile.path, htmlFile.contents, 'utf-8');
  };

  config.langs.forEach((l) => {
    templatesFiles.forEach((f) => {
      buildPugFile(l, f);
    });
  });
  cons.info('Build complete.');
}
