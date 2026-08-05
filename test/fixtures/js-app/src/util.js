function slugify(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, "-");
}

function truncate(value, limit) {
  return value.length > limit ? value.slice(0, limit) : value;
}

module.exports = { slugify, truncate };
