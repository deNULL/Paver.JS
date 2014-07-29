window.Paver = function(dataSource, width, options) {
  var layout = {
    dataSource: dataSource,
    width: width,
    options: options,
    rows: [],

    build: function(fromRow) {
      var rows = this.rows;
      var count = this.dataSource && (this.dataSource.count ? this.dataSource.count() : this.dataSource.length) || 0;
      var last = (rows.length > 0) ? rows[rows.length - 1].range.to : 0;

      var rowWidth = this.width;
      var maxRowHeight = this.options.maxRowHeight || 180;
      var minStackWidth = this.options.minStackWidth || 100;
      var minTileHeight = this.options.minTileHeight || 70;
      var margin = this.options.margin || 2;

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
        mh1000: 0,
        tiles: [],
        range: { from: from }
      };

      function addRow(row, i) {
        row.width = 0;

        for (var j = 0; j < row.stacks.length; j++) {
          var stack = row.stacks[j];
          stack.height = 0;
          stack.width = Math.round(1000 * (row.height - (stack.tiles.length - 1) * margin) / stack.h1000);
          if (j == row.stacks.length - 1) {
            stack.width = rowWidth - row.width;
            row.width = rowWidth;
          } else {
            row.width += stack.width + margin;
          }

          for (var k = 0; k < stack.tiles.length; k++) {
            var tile = stack.tiles[k];
            tile.width = stack.width;
            tile.height = Math.round(tile.data.height * stack.width / tile.data.width);
            if (k == stack.tiles.length - 1) {
              tile.height = row.height - stack.height;
              stack.height = row.height;
            } else {
              stack.height += tile.height + margin;
            }
          }
        }

        delete row.w1000;
        row.range.to = i;
        row.range.len = row.range.to - row.range.from + 1;

        rows.push(row);
      }

      for (var i = from; i < count; i++) {
        var data = this.dataSource && (this.dataSource.get ? this.dataSource.get(i) : this.dataSource[i]) || false;
        if (!data || !data.width || !data.height) {
          // No size available
          if (this.options.defaultSize) {
            data = data || {};
            data.width = this.options.defaultSize.width;
            data.height = this.options.defaultSize.height;
          } else {
            // Stop
            break;
          }
        }

        var h1000 = 1000 * size.height / size.width;
        var sh1000 = stack.h1000 + h1000;
        var mh1000 = Math.min(stack.mh1000, h1000);

        if (stack.tiles.length > 0 && ((1000 * maxRowHeight / sh1000 < minStackWidth) || (mh1000 * maxRowHeight / sh1000 < minTileHeight))) {
          row.w1000 += 1000000 / stack.h1000;

          delete stack.h1000;
          delete stack.mh1000;
          stack.range.to = i - 1;
          stack.range.len = stack.range.to - stack.range.from + 1;

          row.stacks.push(stack);

          stack = {
            h1000: 0,
            mh1000: 0,
            tiles: [],
            range: { from: i }
          }

          row.height = Math.round(1000 * (rowWidth - (row.stacks.length - 1) * margin) / row.w1000);
          if (row.height < maxRowHeight) {
            addRow(row, i);

            row = {
              w1000: 0,
              stacks: [],
              range: { from: i + 1 }
            }
          }
        }

        stack.h1000 += data.height * 1000 / data.width;
        stack.mh1000 = Math.min(stack.mh1000, data.height * 1000 / data.width);
        stack.tiles.push({
          data: data,
          index: i,
        });
      }

      if (row.stacks.length > 0) {
        addRow(row, count - 1);
      }

      return this;
    },
    rebuild: function() {
      return this.build(0);
    }
  }

  layout.render = options.render || function(element) {
    var e = element || document.createElement('div');

    for (var i = 0; i < this.rows.length; i++) {
      e.appendChild(this.rows[i].element || this.renderRow(this.rows[i], { row: i }));
    }

    return e;
  }
  layout.renderRow = options.renderRow || function(row, path) {
    var e = row.element = document.createElement('div');

    e.style.clear = 'both';

    e.style.width = row.width + 'px';
    e.style.height = row.height + 'px';

    for (var i = 0; i < row.stacks.length; i++) {
      e.appendChild(row.stacks[i].element || this.renderStack(row.stacks[i], { row: path.row, stack: i }));
    }

    return e;
  }
  layout.renderStack = options.renderStack || function(stack, path) {
    var e = stack.element = document.createElement('div');

    e.style.float = 'left';

    e.style.width = stack.width + 'px';
    e.style.height = stack.height + 'px';

    for (var i = 0; i < stack.tiles.length; i++) {
      e.appendChild(stack.tiles[i].element || this.renderTile(stack.tiles[i], { row: path.row, stack: path.stack, tile: i }));
    }

    return e;
  }
  layout.renderTile = options.renderTile || function(tile, path) {
    var e = tile.element = document.createElement('div');

    e.style.width = tile.width + 'px';
    e.style.height = tile.height + 'px';

    e.style.marginRight = e.style.marginBottom = this.options.margin || 2;

    e.style.backgroundImage = 'url(' + tile.data.src + ')';
    e.style.backgroundSize = 'cover';
    e.style.backgroundRepeat = 'no-repeat';
    e.style.backgroundPosition = 'center center';

    return e;
  }
  return layout.rebuild();
}