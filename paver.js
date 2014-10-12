window.Paver = function(dataSource, width, options) {
  "use strict";

  options = options || {};

  var layout = {
    dataSource: dataSource,
    width: width,

    preferredArea: options.preferredArea,
    optimizeSteps: options.optimizeSteps || 3,
    getPreferredArea: options.getPreferredArea,
    minRowHeight: options.minRowHeight || (options.preferredArea ? Math.sqrt(options.preferredArea / 2) : 0),
    maxRowHeight: options.maxRowHeight || (options.preferredArea ? Math.sqrt(options.preferredArea * 2) : 180),
    minStackWidth: options.minStackWidth || (options.preferredArea ? Math.sqrt(options.preferredArea / 2) : 100),
    minTileHeight: options.minTileHeight || (options.preferredArea ? Math.sqrt(options.preferredArea * 2) / 3 : 70),
    maxRatio: options.maxRatio || 4,
    minRatio: options.minRatio || 0.333,
    margin: options.margin || 2,
    noStacks: options.noStacks,

    rows: [],

    build: function(fromRow) {
      //console.time('build');
      var rows = this.rows;
      var count = this.dataSource && (this.dataSource.count ? this.dataSource.count() : this.dataSource.length) || 0;
      var last = (rows.length > 0) ? rows[rows.length - 1].range.to : 0;

      var rowWidth = this.width;
      var preferredArea = this.preferredArea;
      var minRowHeight, maxRowHeight,
        minStackWidth, minTileHeight,
        optimizeSteps, getPreferredArea;

      if (preferredArea) {
        optimizeSteps = Math.max(3, this.optimizeSteps || 3);
        getPreferredArea = this.getPreferredArea;
        minRowHeight = this.minRowHeight || Math.sqrt(preferredArea / 2);
        maxRowHeight = this.maxRowHeight || Math.sqrt(preferredArea * 2);
        minStackWidth = this.minStackWidth || Math.sqrt(preferredArea / 2);
        minTileHeight = this.minTileHeight || (Math.sqrt(preferredArea * 2) / 3);
      } else {
        maxRowHeight = this.maxRowHeight || 180;
        minStackWidth = this.minStackWidth || 100;
        minTileHeight = this.minTileHeight || 70;
      }

      var maxRatio = this.maxRatio || 4;
      var minRatio = this.minRatio || 0.333;
      var margin = this.margin || 2;
      var noStacks = this.noStacks;

      if (fromRow === undefined) {
        if (last == count - 1) {
          return;
        }

        fromRow = rows.length - 1;
      }

      fromRow = Math.max(Math.min(fromRow, rows.length), 0);

      rows.length = fromRow; // Truncate

      var from = (fromRow < rows.length) ? rows[fromRow].range.from : 0;

      var row = {
        w1000: 0,
        stacks: [],
        range: { from: from }
      }, stack = {
        h1000: 0,
        mh1000: 1000000,
        tiles: [],
        range: { from: from }
      };

      var best = false, bestScore, step = 0, totalScore = 0;

      function compute(row, i) {
        var score = 0;

        row.width = 0;

        for (var j = 0; j < row.stacks.length; j++) {
          var stack = row.stacks[j];
          stack.height = 0;
          stack.width = Math.round(1000 * (row.height - (stack.tiles.length - 1) * margin) / stack.h1000);
          if (i < count - 1 && j == row.stacks.length - 1) {
            stack.width = rowWidth - row.width;
            row.width = rowWidth;
          } else {
            row.width += stack.width + margin;
          }

          for (var k = 0; k < stack.tiles.length; k++) {
            var tile = stack.tiles[k];
            var ratio = Math.max(Math.min(tile.data.width / tile.data.height, maxRatio), minRatio);
            tile.width = stack.width;
            tile.height = Math.round(stack.width / ratio);
            if (k == stack.tiles.length - 1) {
              tile.height = row.height - stack.height;
              stack.height = row.height;
            } else {
              stack.height += tile.height + margin;
            }

            if (preferredArea) {
              var diff = (tile.width * tile.height - (getPreferredArea ? getPreferredArea(tile.data, tile.index) || preferredArea : preferredArea));
              score += diff * diff;
            }
          }

          delete stack.h1000;
          delete stack.mh1000;
        }

        delete row.w1000;

        row.range.to = i;
        row.range.len = row.range.to - row.range.from + 1;
        return score / row.range.len;
      }

      //console.groupCollapsed('row #' + rows.length);
      for (var i = from; i < count; i++) {
        var data = this.dataSource && (this.dataSource.get ? this.dataSource.get(i) : this.dataSource[i]) || false;
        var ratio;

        if (this.getRatio) {
          ratio = this.getRatio(data, i);
        } else {
          if (!data || !data.width || !data.height) {
            // No size available
            if (this.defaultSize) {
              data = data || {};
              data.width = this.defaultSize.width;
              data.height = this.defaultSize.height;
            } else {
              // Stop
              break;
            }
          }

          ratio = data.width / data.height;
        }

        ratio = Math.max(Math.min(ratio, maxRatio), minRatio);

        var h1000 = 1000 / ratio;
        var sh1000 = stack.h1000 + h1000;
        var mh1000 = Math.min(stack.mh1000, h1000);

        var rowHeight = preferredArea ? minRowHeight + step * (maxRowHeight - minRowHeight) / (optimizeSteps - 1) : maxRowHeight;

        if (stack.tiles.length > 0 && (noStacks || (1000 * rowHeight / sh1000 < minStackWidth) || (mh1000 * rowHeight / sh1000 < minTileHeight))) {
          row.w1000 += 1000000 / stack.h1000;

          stack.range.to = i - 1;
          stack.range.len = stack.range.to - stack.range.from + 1;

          row.stacks.push(stack);

          row.height = Math.round(1000 * (rowWidth - (row.stacks.length - 1) * margin) / row.w1000);
          if (row.height <= rowHeight) {
            if (!preferredArea) {
              compute(row, i);
              rows.push(row);
            } else {
              var score = compute(row, i);
              //console.log('count = ' + row.range.len + ', h = ' + rowHeight + ', stddev = ' + Math.sqrt(score));
              if (!best || (score < bestScore)) {
                best = row, bestScore = score;
              }

              step++;
              if (step >= optimizeSteps) {
                //console.groupEnd();
                rows.push(best);
                //console.groupCollapsed('row #' + rows.length);
                i = best.range.to;

                totalScore += score;

                best = false, bestScore = 1000000;
                step = 0;
              } else {
                i = row.range.from;
              }
            }

            row = {
              w1000: 0,
              stacks: [],
              range: { from: i }
            }
          }

          stack = {
            h1000: 0,
            mh1000: 1000000,
            tiles: [],
            range: { from: i }
          }
        }

        stack.h1000 += 1000 / ratio;
        stack.mh1000 = Math.min(stack.mh1000, 1000 / ratio);
        stack.tiles.push({
          data: data,
          index: i,
        });
      }
      //console.groupEnd();

      if (row.stacks.length > 0) {
        row.height = Math.min(row.height, maxRowHeight);
        totalScore += compute(row, count - 1);
        rows.push(row);
      }

      //console.log('total score (stddev from ' + preferredArea + '): ' + Math.sqrt(totalScore / rows.length));

    //console.timeEnd('build');
      return this;
    },
    rebuild: function() {
      return this.build(0);
    }
  }

  layout.render = options.render || function(element) {
    var e = element || document.createElement('div');

    //console.time('render');

    e.style.position = 'relative';

    //console.time('check');
    var node = e.firstChild;
    while (node) {
      node.paverDelete = true;
      node = node.nextSibling;
    }
    //console.timeEnd('check');

    var childs = [];

    var rowTop = 0;
    for (var i = 0; i < this.rows.length; i++) {
      var row = this.rows[i];
      var stackLeft = 0;
      for (var j = 0; j < row.stacks.length; j++) {
        var stack = row.stacks[j];
        var tileTop = 0;
        for (var k = 0; k < stack.tiles.length; k++) {
          var tile = stack.tiles[k];
          var child = tile.element || this.renderTile(tile, { row: i, stack: j, tile: k });

          child.style.position = 'absolute';
          child.style.top = (rowTop + tileTop) + 'px';
          child.style.left = stackLeft + 'px';
          child.style.width = tile.width + 'px';
          child.style.height = tile.height + 'px';

          if (child.parentNode != e) {
            childs.push(child);
          } else {
            child.paverDelete = false;
          }

          tileTop += tile.height + this.margin;
        }
        stackLeft += stack.width + this.margin;
      }
      rowTop += row.height + this.margin;
    }

    //console.time('check');
    var node = e.firstChild;
    while (node) {
      var next = node.nextSibling;
      if (node.paverDelete) {
        e.removeChild(node);
      }
      delete node.paverDelete;
      node = next;
    }
    //console.timeEnd('check');

    for (var i = 0; i < childs.length; i++) {
      e.appendChild(childs[i]);
    }

    //console.timeEnd('render');

    return e;
  }
  layout.renderTile = options.renderTile || function(tile, path) {
    var e = tile.element = document.createElement('div');

    e.style.width = tile.width + 'px';
    e.style.height = tile.height + 'px';

    e.style.backgroundImage = 'url(' + tile.data.src + ')';
    e.style.backgroundSize = 'cover';
    e.style.backgroundRepeat = 'no-repeat';
    e.style.backgroundPosition = 'center center';

    return e;
  }
  return layout.rebuild();
}