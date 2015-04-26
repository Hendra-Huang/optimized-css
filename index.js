var fs = require('fs'),
  css = require('css'),
  cheerio = require('cheerio')
;
var Stylesheet = require('./lib/stylesheet');

var file = process.argv[2] ,
  $ = cheerio.load(fs.readFileSync(file))
;

stylesheets = new Stylesheet($('link'));

var selectorMatching = function(dom) {
  var hashtable = {
    id: {},
    class: {},
    tag: {},
    uncategorized: {}
  };

  var getRightMostSelector = function(selector) {
    var selectorToken = /(?=\.)|(?=#)|(?=\[)|(?= )/,
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
  var attributes = dom.attribs;
  var matchedRules = [];
  if (attributes !== undefined) {
    if ('id' in attributes) {
      var rules = hashtable.id['#'+attributes.id];

      if (rules !== undefined) {
        // loop from the last so there will be no problem when splice the array
        for (var i = rules.length - 1; i >= 0; i--) {
          var selector = rules[i].selector;

          if ($(dom).is(selector)) {
            matchedRules.push(rules[i]);
            rules.splice(i, 1); // splice for removing the rule from hashtable
          }
        }
      }
    }
    if ('class' in attributes) {
      var rules = hashtable.class['.'+attributes.class];

      if (rules !== undefined) {
        // loop from the last so there will be no problem when splice the array
        for (var i = rules.length - 1; i >= 0; i--) {
          var selector = rules[i].selector;

          if ($(dom).is(selector)) {
            matchedRules.push(rules[i]);
            rules.splice(i, 1); // splice for removing the rule from hashtable
          }
        }
      }
    }

    // select from tag hashtable
    var rules = hashtable.tag[dom.name];
    if (rules !== undefined) {
      // loop from the last so there will be no problem when splice the array
      for (var i = rules.length - 1; i >= 0; i--) {
        var selector = rules[i].selector;

        if ($(dom).is(selector)) {
          matchedRules.push(rules[i]);
          rules.splice(i, 1); // splice for removing the rule from hashtable
        }
      }
    }

    // select from uncategorized
    for (property in hashtable.uncategorized) {
      var rules = hashtable.uncategorized[property];
      // loop from the last so there will be no problem when splice the array
      for (var i = rules.length - 1; i >= 0; i--) {
        var selector = rules[i].selector;

        if ($(dom).is(selector)) {
          matchedRules.push(rules[i]);
          rules.splice(i, 1); // splice for removing the rule from hashtable
        }
      }
    }
  }

  //console.log(matchedRules);
  return matchedRules;
};

// Algorithm Matched Selector
var annotatedRules = [],
  selectableDOM = [],
  id = 1,
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
    });
  }
}
console.log(selectableDOM);

//var result = css.stringify(ast);
//console.log(ast.stylesheet.rules[0]);
//console.log(result);
//console.log($("#a").is(rule.selector));
