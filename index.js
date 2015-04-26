var fs = require('fs'),
  css = require('css'),
  cheerio = require('cheerio')
;
var Stylesheet = require('./lib/stylesheet');

var file = process.argv[2] ,
  $ = cheerio.load(fs.readFileSync(file))
;

stylesheets = new Stylesheet($('link'));

var SelectorMatching = function() {
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
          var rightMostSelector = getRightMostSelector(selector);

          if (rightMostSelector[0] == '#') {
            if (rightMostSelector in hashtable.id) {
              hashtable.id[rightMostSelector].push({
                selector: selector, 
                declarations: declarations,
                orderPosition: orderPosition
              });
            } else {
              hashtable.id[rightMostSelector] = [{
                selector: selector,
                declarations: declarations,
                orderPosition: orderPosition
              }];
            }
          } else if (rightMostSelector[0] == '.') {
            if (rightMostSelector in hashtable.class) {
              hashtable.class[rightMostSelector].push({
                selector: selector,
                declarations: declarations,
                orderPosition: orderPosition
              });
            } else {
              hashtable.class[rightMostSelector] = [{
                selector: selector,
                declarations: declarations,
                orderPosition: orderPosition
              }];
            }
          } else if (rightMostSelector.match(/^\w+/)) {
            if (rightMostSelector in hashtable.tag) {
              hashtable.tag[rightMostSelector].push({
                selector: selector, 
                declarations: declarations,
                orderPosition: orderPosition
              });
            } else {
              hashtable.tag[rightMostSelector] = [{
                selector: selector, 
                declarations: declarations,
                orderPosition: orderPosition
              }];
            }
          } else {
            if (rightMostSelector in hashtable.uncategorized) {
              hashtable.uncategorized[rightMostSelector].push({
                selector: selector, 
                declarations: declarations,
                orderPosition: orderPosition
              });
            } else {
              hashtable.uncategorized[rightMostSelector] = [{
                selector: selector,
                declarations: declarations,
                orderPosition: orderPosition
              }];
            }
          }
          orderPosition++;
        });
      }
    });
  });

  // selector matching
  return function(dom) {
    var attributes = dom.attribs;
    var matchedRules = [];
    if (attributes !== undefined) {
      if ('id' in attributes) {
        var rules = hashtable.id['#'+attributes.id];

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
        var rules = hashtable.class['.'+attributes.class];

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
      var rules = hashtable.tag[dom.name];
      if (rules !== undefined) {
        rules.forEach(function(rule) {
          var selector = rule.selector;

          if ($(dom).is(selector)) {
            matchedRules.push(rule);
          }
        });
      }

      // select from uncategorized
      for (property in hashtable.uncategorized) {
        var rules = hashtable.uncategorized[property];
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
};

// Algorithm Matched Selector
var annotatedRules = [],
  selectableDOM = [],
  id = 1,
  selectorMatching = SelectorMatching(),
  stack = [$('body')[0]]
;
while (stack.length > 0) {
  var node = stack.pop(),
    children = [],
    matchedRules
  ;
  node.id = id;
  id++;

  if (node.children !== undefined) {
    node.children.forEach(function(child) {
      if (child.type == 'tag') {
        children.push(child);
      }
    });
    stack = stack.concat(children);
  }

  matchedRules = selectorMatching(node);
  if (matchedRules.length > 0) {
    selectableDOM.push(node);
    matchedRules.forEach(function(rule) {
      // if the rule doesn't exist, then push it to annotatedRules
      var duplicate = annotatedRules.filter(function(annotatedRule) {
        if (annotatedRule.orderPosition == rule.orderPosition) {
          return true;
        }

        return false;
      })

      if (duplicate.length == 0) {
        var nodes = [],
          selector = rule.selector
        ;

        $(selector).each(function(key, element) {
          nodes.push(element);
        });
        
        annotatedRules.push({
          selector: selector,
          declarations: rule.declarations,
          orderPosition: rule.orderPosition,
          matched: true,
          matchedNodes: nodes
        });
      }
    });
  }
}
//console.log(annotatedRules[3].matchedNodes);

// Order Specificity
var orderSpecificity = function(rules) {
  var getSelectorScore = function(selector) {
    var selectorToken = /(?=\.)|(?=#)|(?=\[)|(?= \w+)|\>|\+/,
      tokenizedSelector = selector.split(selectorToken),
      score = 0
    ;

    tokenizedSelector.forEach(function(token, index) {
      if (token.trim()[0] == '#') {
        score += 100;
      } else if (token.trim()[0] == '.' || token[0] == '[') {
        score += 10;
      } else if (token.trim()[0].match(/^\w+/)) {
        score += 1;
      }
    })

    return score;
  };

  rules.forEach(function(rule, index) {
    var selector = rule.selector,
      scores = [],
      orderedRules = [],
      score = getSelectorScore(selector)
    ;

    scores.push(score);
    orderedRules.push(rule);
    if (scores.length > 1) {
      for (var i = scores.length - 1; i > 0; i--) {
        if (scores[i - 1] < scores[i]) {
          // swap the score
          var temp = scores[i - 1];
          scores[i - 1] = scores[i];
          scores[i] = temp;
          // swap the selector
          var temp = orderedRules[i - 1];
          orderedRules[i - 1] = orderedRules[i];
          orderedRules[i] = temp;
        } else if (scores[i - 1] == score[i]) {
          if (orderedRules[i - 1].orderPosition < orderedRules.orderPosition) {
            // swap the selector
            var temp = orderedRules[i - 1];
            orderedRules[i - 1] = orderedRules[i];
            orderedRules[i] = temp;
          }
        }
      }
    }

    return orderedRules;
  });
};

// Algorithm Effective Selector
selectableDOM.forEach(function(dom) {
  var getMatchingRules = function(dom) {
    var matchedRules = [];

    annotatedRules.forEach(function(rule) {
      rule.matchedNodes.forEach(function(node) {
        if (node.id == dom.id) {
          matchedRules.push(rule);
        }
      });
    });

    return matchedRules;
  };

  var rules = getMatchingRules(dom),
    orderedRules = orderSpecificity(rules)
  ;
});

//var result = css.stringify(ast);
//console.log(ast.stylesheet.rules[0]);
//console.log(result);
//console.log($("#a").is(rule.selector));
