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
  parse : function(links, path) {
    var stylesheetPaths = [];
    links.each(function() {
      var filename;

      if (this.type == 'tag' && this.attribs.href != '') {
        filename = this.attribs.href;

        if (this.attribs.rel == 'stylesheet' || this.attribs.type == 'text/css') {
          stylesheetPaths.push(decodeURI(path + '/' + decodeURIComponent(filename)));
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
