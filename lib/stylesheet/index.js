var fs = require('fs'),
  css = require('css')
;

/**
 * Parse link stylesheet yang diberikan
 *
 * @param array links 
 * 
 * @return array parsedStylesheets
 */
module.exports = {
    parse : function(links, options) {
    options = options || {};

    var stylesheetPaths = [];
    links.each(function() {
      var filename;

      if (this.type == 'tag' && this.attribs.href != '') {
        filename = this.attribs.href;

        if (filename.substr(-3) == 'css') {
          stylesheetPaths.push(filename);
        }
      }
    });

    var parsedStylesheets = [];
    stylesheetPaths.forEach(function(element, index, array) {
      var file = fs.readFileSync(element, {encoding: 'utf-8'});

      parsedStylesheets.push(css.parse(file, {source: element}))
    });

    return parsedStylesheets;
  }
}
