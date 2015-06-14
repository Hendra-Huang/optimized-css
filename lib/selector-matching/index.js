var selectorParse = require('../selector-parse');

// unescape selector
var re_escape = /\\([\da-f]{1,6}\s?|(\s)|.)/ig,
  funescape = function(_, escaped, escapedWhitespace) {
    var high = "0x" + escaped - 0x10000;
    // NaN means non-codepoint
    // Support: Firefox
    // Workaround erroneous numeric interpretation of +"0x"
    return high !== high || escapedWhitespace ?
      escaped :
      // BMP codepoint
      high < 0 ?
        String.fromCharCode( high + 0x10000 ) :
        // Supplemental Plane codepoint (surrogate pair)
        String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
  },
  unescapeCSS = function(selector) {
    return selector.replace(re_escape, funescape);
  }
;

module.exports = {
  hashtable: {
    id: {},
    class: {},
    tag: {},
    uncategorized: {}
  },
  generateHashtable: function(stylesheets) {
    var hashtable = {
      id: {},
      class: {},
      tag: {},
      uncategorized: {}
    };

    var getRightMostSelector = function(selector) {
      //var selectorToken = /([^\\](?=\.))|(?=#)|(?=\[)|(?= \w+)|\>|\+|\*(?!=)|\~(?!=)|(?=:not\(.*\))/,
        //tokenizedSelector = selector.split(selectorToken)
      //;
      var tokens = selectorParse(selector)[0];

      return tokens.pop().trim();
    }
    var clone = function(obj) {
      if (null == obj || "object" != typeof obj) return obj;
      var copy = obj.constructor();
      for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
      }

      return copy;
    }

    // generate hashtable
    var orderPosition = 1;
    stylesheets.forEach(function(stylesheet) {
      var rules = stylesheet.stylesheet.rules,
        insertRuleToHashtable = function(rule, media) {
          media = media || '';
          var selectors = rule.selectors,
            declarations = rule.declarations
          ;

          if (selectors !== undefined) {
            selectors.forEach(function(selector) {
              if (selector !== undefined && selector.trim().length > 0) {
                var rightMostSelector = getRightMostSelector(selector),
                  //tokenizedSelectors = rightMostSelector.split(/:+(?!not\(.*\))(?=\w+|-)/),
                  ruleData = {
                    selector: selector, 
                    declarations: declarations.map(function(declaration) { return clone(declaration) }),
                    orderPosition: orderPosition,
                    media: media
                  }
                ;

                // testing selector without pseudo-class
                //rightMostSelector = unescapeCSS(tokenizedSelectors.length > 1 ? tokenizedSelectors[0].trim() : rightMostSelector);

                if (rightMostSelector[0] == '#') {
                  if (rightMostSelector in hashtable.id) {
                    hashtable.id[rightMostSelector].push(ruleData);
                  } else {
                    hashtable.id[rightMostSelector] = [ruleData];
                  }
                } else if (rightMostSelector[0] == '.') {
                  if (rightMostSelector in hashtable.class) {
                    hashtable.class[rightMostSelector].push(ruleData);
                  } else {
                    hashtable.class[rightMostSelector] = [ruleData];
                  }
                } else if (rightMostSelector.match(/^\w+/)) {
                  if (rightMostSelector in hashtable.tag) {
                    hashtable.tag[rightMostSelector].push(ruleData);
                  } else {
                    hashtable.tag[rightMostSelector] = [ruleData];
                  }
                } else {
                  rightMostSelector = rightMostSelector === '' ? 'all' : rightMostSelector;
                  if (rightMostSelector in hashtable.uncategorized) {
                    hashtable.uncategorized[rightMostSelector].push(ruleData);
                  } else {
                    hashtable.uncategorized[rightMostSelector] = [ruleData];
                  }
                }

                orderPosition++;
              }
            });
          }
        }
      ;

      rules.forEach(function(rule) {
        if (rule.type == 'media') {
          var media = rule.media;

          rule.rules.forEach(function(mediaRule) {
            insertRuleToHashtable(mediaRule, media);
          });
        } else if (rule.type == 'rule') {
          insertRuleToHashtable(rule);
        }
      });
    });

    //console.log(hashtable);
    this.hashtable = hashtable;
  },
  getRules: function(dom, $) {
    var attributes = dom.attribs;
    var matchedRules = [];
    if (attributes !== undefined) {
      if ('id' in attributes) {
        var rules = this.hashtable.id['#'+attributes.id];

        if (rules !== undefined) {
          rules.forEach(function(rule) {
            var selector = rule.selector,
              subSelector = selector.replace(/[^\\]:+(?!not\(.*\))[\w-\(\)\d\+]+/g, function(match) { return match.substring(0, 1); })
            ;
            if (subSelector === '' || subSelector.indexOf(':') !== -1 || $(dom).is(subSelector)) {
              matchedRules.push(rule);
            }
          });
        }
      }
      if ('class' in attributes) {
        var classes = attributes.class.split(/\ |\r|\n/),
          rules = []
        ;
        classes.forEach(function(_class) {
          _class = _class.trim();
          rules = rules.concat(this.hashtable.class['.'+_class] === undefined ? [] : this.hashtable.class['.'+_class]);
        }.bind(this));

        if (rules !== undefined) {
          rules.forEach(function(rule) {
            var selector = rule.selector,
              subSelector = selector.replace(/[^\\]:+(?!not\(.*\))[\w-\(\)\d\+]+/g, function(match) { return match.substring(0, 1); })
            ;
            if (subSelector === '' || subSelector.indexOf(':') !== -1 || $(dom).is(subSelector)) {
              matchedRules.push(rule);
            }
          });
        }
      }

      // select from tag hashtable
      var rules = this.hashtable.tag[dom.name];
      if (rules !== undefined) {
        rules.forEach(function(rule) {
          var selector = rule.selector,
            subSelector = selector.replace(/[^\\]:+(?!not\(.*\))[\w-\(\)\d\+]+/g, function(match) { return match.substring(0, 1); })
          ;
          if (subSelector === '' || subSelector.indexOf(':') !== -1 || $(dom).is(subSelector)) {
            matchedRules.push(rule);
          }
        });
      }

      // select from uncategorized
      for (property in this.hashtable.uncategorized) {
        var rules = this.hashtable.uncategorized[property];
        rules.forEach(function(rule) {
          var selector = rule.selector,
            subSelector = selector.replace(/[^\\]:+(?!not\(.*\))[\w-\(\)\d\+]+/g, function(match) { return match.substring(0, 1); })
          ;
          if (subSelector === '' || subSelector.indexOf(':') !== -1 || $(dom).is(subSelector)) {
            matchedRules.push(rule);
          }
        });
      }
    }

    //console.log(matchedRules);
    return matchedRules;
  }
}
