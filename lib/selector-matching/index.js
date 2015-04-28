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
      var selectorToken = /(?=\.)|(?=#)|(?=\[)|(?= \w+)|\>|\+/,
        tokenizedSelector = selector.split(selectorToken)
      ;

      return tokenizedSelector.pop().trim();
    }

    // generate hashtable
    var orderPosition = 1;
    stylesheets.forEach(function(stylesheet) {
      var rules = stylesheet.stylesheet.rules;

      rules.forEach(function(rule) {
        if (rule.type == 'rule') {
          var selectors = rule.selectors,
            declarations = rule.declarations
          ;

          selectors.forEach(function(selector) {
            var rightMostSelector = getRightMostSelector(selector),
              ruleData = {
                selector: selector, 
                declarations: declarations,
                orderPosition: orderPosition
              }
            ;

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
              if (rightMostSelector in hashtable.uncategorized) {
                hashtable.uncategorized[rightMostSelector].push(ruleData);
              } else {
                hashtable.uncategorized[rightMostSelector] = [ruleData];
              }
            }

            orderPosition++;
          });
        }
      });
    });

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
            var selector = rule.selector;

            if ($(dom).is(selector)) {
              matchedRules.push(rule);
            }
          });
        }
      }
      if ('class' in attributes) {
        var rules = this.hashtable.class['.'+attributes.class];

        if (rules !== undefined) {
          rules.forEach(function(rule) {
            var selector = rule.selector;

            if ($(dom).is(selector)) {
              matchedRules.push(rule);
            }
          });
        }
      }

      // select from tag hashtable
      var rules = this.hashtable.tag[dom.name];
      if (rules !== undefined) {
        rules.forEach(function(rule) {
          var selector = rule.selector;

          if ($(dom).is(selector)) {
            matchedRules.push(rule);
          }
        });
      }

      // select from uncategorized
      for (property in this.hashtable.uncategorized) {
        var rules = this.hashtable.uncategorized[property];
        rules.forEach(function(rule) {
          var selector = rule.selector;

          if ($(dom).is(selector)) {
            matchedRules.push(rule);
          }
        });
      }
    }

    //console.log(matchedRules);
    return matchedRules;
  }
}
