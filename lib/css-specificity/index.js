var selectorParse = require('../selector-parse');

module.exports = {
  order: function(rules) {
    var orderedRules = [],
      scores = []
    ;

    var getSelectorScore = function(selector) {
      var tokens = selectorParse(selector)[0],
        score = 0
      ;

      tokens.forEach(function(token, index) {
        if (token !== undefined) {
          if (token.trim()[0] == '#') {
            score += 100;
          } else if (token.trim()[0] == '.' || token[0] == '[') {
            score += 10;
          } else if (token.trim().match(/^\w+/)) {
            score += 1;
          }
          if (token.search(/:+(after|before|first-line|first-letter)/) !== -1) {
            score += 1;
          } else if (token.search(/:+\w+/) !== -1) {
            score += 10;
          }
        }
      })

      return score;
    };

    rules.forEach(function(rule, index) {
      var selector = rule.selector,
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
          } else if (scores[i - 1] == scores[i]) {
            if (orderedRules[i - 1].orderPosition < orderedRules[i].orderPosition) {
              // swap the selector
              var temp = orderedRules[i - 1];
              orderedRules[i - 1] = orderedRules[i];
              orderedRules[i] = temp;
            }
          }
        }
      }
    });

    return orderedRules;
  }
}
