module.exports = {
  order: function(rules) {
    var orderedRules = [];

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
    });

    return orderedRules;
  }
}
