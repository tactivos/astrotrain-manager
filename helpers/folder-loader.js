const compact = require('lodash/compact');
const flattenDeep = require('lodash/flattenDeep');
const fs = require('fs');
const path = require('path');

/* This will automatically require all files inside a directory */
const loader = (directory, whitelist) => {

  const dir = path.resolve(directory);
  const files = fs.readdirSync(dir);

  const results = files.map(file => {
    const filePath = `${dir}/${file}`;
    if (fs.lstatSync(filePath).isDirectory()) return loader(filePath, whitelist);
    if (whitelist.indexOf(file) === -1) return null;
    return filePath;
  });

  return compact(flattenDeep(results));

}

module.exports = loader;
