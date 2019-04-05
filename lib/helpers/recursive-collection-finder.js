/*
  Recusively search a string in a collection & returns the full object where the
  string was found.
*/

const finder = (search, collection) =>
  collection.find(obj => Object.keys(obj).find(key => {
    if (typeof obj[key] === 'object') return finder(search, [obj[key]]);
    return typeof obj[key] === 'string' ? obj[key] === search : null;
  })
);

module.exports = (search, collection) => {
  if (typeof search !== 'string')
    throw Error('Recursive collection finder needs a string as first parameter');

  if (!Array.isArray(collection) || !collection.every(o => typeof o === 'object'))
    throw Error('Recursive collection finder needs a collection as second parameter');

  return finder(search, collection);
}
