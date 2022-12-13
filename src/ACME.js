/**
 * @file ACME - the Axis-aligned Collision Management Engine
 * @version 4.0.0.d-Beta
 * @author J Stewart (HSstudent16)
 * @license MIT
 * @copyright 2022 James Stewart
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining  a  copy   of  this   software   and   associated
 * documentation  files  (the  "Software"),  to  deal  in  the
 * Software without restriction,  including without limitation
 * the rights to use, copy, modify, merge, publish, distribute,
 * sublicense,  and/or  sell copies  of the  Software, and  to
 * permit persons to  whom the Software  is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall
 * be included  in all copies or  substantial portions of  the
 * Software.
 *
 * THE SOFTWARE  IS PROVIDED "AS  IS", WITHOUT  WARRANTY OF ANY
 * KIND, EXPRESS OR IMPLIED,  INCLUDING BUT NOT  LIMITED TO THE
 * WARRANTIES  OF MERCHANTABILITY,  FITNESS  FOR  A  PARTICULAR
 * PURPOSE AND  NONINFRINGEMENT. IN NO EVENT SHALL THE  AUTHORS
 * OR COPYRIGHT  HOLDERS BE  LIABLE  FOR ANY  CLAIM, DAMAGES OR
 * OTHER  LIABILITY, WHETHER IN AN ACTION OF CONTRACT,  TORT OR
 * OTHERWISE, ARISING FROM, OUT  OF OR IN  CONNECTION  WITH THE
 * SOFTWARE OR THE  USE  OR  OTHER  DEALINGS  IN  THE  SOFTWARE.
 *
 * @todo - Debug!
 */
const ACME = (function (udf) {
  let root = this, dumpConsts = false;
  if (root && "document" in root) dumpConsts = true;
  let Func = root.Function;
  let BigInt = root.BigInt;
  let Math = root.Math;
  function sq (a) { return a * a; }
  Math.sq = sq;
  function lerp (a, b, c) { return a + (b - a) * c; }
  Math.lerp = lerp;
  function linear (a, b, c) { return a - c > b ? a - c : a + c < b ? a + c : b; }
  Math.linear = linear;
  function constrain (a, b, c) { return a < b ? b : a > c ? c : a; }
  Math.constrain = constrain;
  let __TypedArray;
  try {
    __TypedArray = root.Uint8Array[["__proto__"]];
  } catch (err) {
    __TypedArray = root.Int8Array;
  }
  let games = {},
  templates = {},
  modules = {},
  // A `this` attribute ascribed to incoming module functions
  moduleSandbox = {},
  // A list of needed modules (filled as needed when a module loads)
  dependencies = {},
  coll_consts = {},
  move_consts = {},
  // The bitmasks themselves
  bitmasks = {
    movement: {
      x: 0n,
      y: 0n
    },
    collisions: {
      top: 0n,
      right: 0n,
      bottom: 0n,
      left: 0n
    }
  },
  // Global-ish ACME status
  initialized = false,
  movements = [],
  collisions = [];
  let exports = {};
  // Establish constant manipulators
  (function () {
    function createCollisionRule (config) {
      let num = 1n << BigInt(collisions.length);
      if ("value" in config) { num = BigInt(config.value); }
      if (!config.name) {
        throw "ACME_Internal_Error: Failed to create collision rule. A name must be provided.";
      }
      collisions.push(config.code);
      coll_consts[config.name.toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_")] = num;
      return num;
    }
    Object.defineProperty(
      moduleSandbox,
      "createCollisionRule",
      {value: createCollisionRule, writable: false}
    );
    function createMovementRule (config) {
      let num = 1n << BigInt(movements.length);
      if ("value" in config) {
        num = BigInt(config.value);
      }
      if (!config.name) {
        throw "ACME_Internal_Error: Failed to create movement rule. A name must be provided.";
      }
      movements.push(config.code);
      move_consts[config.name.toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_")] = num;
      return num;
    }
    Object.defineProperty(
      moduleSandbox,
      "createMovementRule",
      {value: createMovementRule, writable: false}
    );
    function createCollisionShorthand (config) {
      let num = 0n;
      if (!config.name) {
        throw "ACME_Internal_Error: Failed to create collision shorthand. A name must be provided.";
      }
      if (!("rules" in config)) {
        throw "ACME_Internal_Error: Failed to create collision shorthand.  A list of rules must be provided.";
      }
      for (let i = config.rules.length; i--;) {
        let r = config.rules[i].toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
        if (r in coll_consts && coll_consts.hasOwnProperty(r)) {
          num |= coll_consts[r];
        }
      }
      coll_consts[config.name.toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_")] = num;
      return num;
    }
    Object.defineProperty(
      moduleSandbox,
      "createCollisionShorthand",
      {value: createCollisionShorthand, writable: false}
    );
    function createMovementShorthand (config) {
      let num = 0n;
      if (!config.name) {
        throw "ACME_Internal_Error: Failed to create movement shorthand. A name must be provided.";
      }
      if (!("rules" in config)) {
        throw "ACME_Internal_Error: Failed to create movement shorthand.  A list of rules must be provided.";
      }
      for (let i = config.rules.length; i--;) {
        let r = config.rules[i].toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
        if (r in move_consts && move_consts.hasOwnProperty(r)) {
          num |= move_consts[r];
        }
      }
      move_consts[config.name.toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_")] = num;
      return num;
    }
    Object.defineProperty(
      moduleSandbox,
      "createMovementShorthand",
      {value: createMovementShorthand, writable: false}
    );
    function editCollisionShorthand (config) {
      if (!config.name) {
        throw "ACME_Internal_Error: Failed to modify collision shorthand.  A name must be provided.";
      }
      let name = config.name.toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
      if (!(name in coll_consts)) {
        throw "ACME_Internal_Error: Failed to modify collision shorthand \"" + name + "\".  No such shorthand exists.";
      }
      let num = coll_consts[name];
      if (!("rules" in config)) {
        throw "ACME_Internal_Error: Failed to modify collision shorthand.  A list of rules must be provided.";
      }
      for (let i = config.rules.length; i--;) {
        let r = config.rules[i].toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
        if (r in coll_consts && coll_consts.hasOwnProperty(r)) {
          num |= coll_consts[r];
        }
      }
      return (coll_consts[name] = num);
    }
    Object.defineProperty(
      moduleSandbox,
      "editCollisionShorthand",
      {value: editCollisionShorthand, writable: false}
    );
    function editMovementShorthand (config) {
      if (!config.name) {
        throw "ACME_Internal_Error: Failed to create movement shorthand. A name must be provided.";
      }
      let name = config.name.toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
      if (!(name in move_consts)) {
        throw "ACME_Internal_Error: Failed to modify movement shorthand \"" + name + "\".  No such shorthand exists.";
      }
      let num = move_consts[name];
      if (!("rules" in config)) {
        throw "ACME_Internal_Error: Failed to create movement shorthand.  A list of rules must be provided.";
      }
      for (let i = config.rules.length; i--;) {
        let r = config.rules[i].toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
        if (r in move_consts && move_consts.hasOwnProperty(r)) {
          num |= move_consts[r];
        }
      }
      move_consts[name] = num;
      return num;
    }
    Object.defineProperty(
      moduleSandbox,
      "editMovementShorthand",
      {value: editMovementShorthand, writable: false}
    );
    function editCollisionBitmasks (config) {
      let i, r;
      if (config.top && config.top instanceof Array) {
      for (i = config.top.length; i--;) {
        r = config.top[i].toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
        if (r in coll_consts && coll_consts.hasOwnProperty(r)) {
          bitmasks.collisions.top |= coll_consts[r];
        }
      }
      }
      if (config.left && config.left instanceof Array) {
      for (i = config.left.length; i--;) {
        r = config.left[i].toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
        if (r in coll_consts && coll_consts.hasOwnProperty(r)) {
          bitmasks.collisions.left |= coll_consts[r];
        }
      }
      }
      if (config.bottom && config.bottom instanceof Array) {
      for (i = config.bottom.length; i--;) {
        r = config.bottom[i].toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
        if (r in coll_consts && coll_consts.hasOwnProperty(r)) {
          bitmasks.collisions.bottom |= coll_consts[r];
        }
      }
      }
      if (config.right && config.right instanceof Array) {
      for (i = config.right.length; i--;) {
        r = config.right[i].toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
        if (r in coll_consts && coll_consts.hasOwnProperty(r)) {
          bitmasks.collisions.right |= coll_consts[r];
        }
      }
      }
      return null & void arguments;
    }
    Object.defineProperty(
      moduleSandbox,
      "editCollisionBitmasks",
      {value: editCollisionBitmasks, writable: false}
    );
    function editMovementBitmasks (config) {
      let i, r;
      if (config.y && config.y instanceof Array) {
      for (i = config.y.length; i--;) {
        r = config.y[i].toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
        if (r in move_consts && move_consts.hasOwnProperty(r)) {
          bitmasks.movement.y |= move_consts[r];
        }
      }
      }
      if (config.x && config.x instanceof Array) {
      for (i = config.x.length; i--;) {
        r = config.x[i].toUpperCase().replace(/[^A-Za-z0-9$_]/g, "_");
        if (r in move_consts && move_consts.hasOwnProperty(r)) {
          bitmasks.movement.x |= move_consts[r];
        }
      }
      }
      return null & void arguments;
    }
    Object.defineProperty(
      moduleSandbox,
      "editMovementBitmasks",
      {value: editMovementBitmasks, writable: false}
    );
    function createCollisionRules (config) {
      if (config instanceof Array) {
        for (let i = config.length; i--;) {
          createCollisionRule(config[i]);
        }
      } else if (arguments.length > 1) {
        for (let i = arguments.length; i--;) {
          createCollisionRule(arguments[i]);
        }
      } else {
        for (let i in config) {
          if (!config.hasOwnProperty(i)) { continue; }
          config[i].name = i;
          createCollisionRule(config[i]);
        }
      }
    }
    Object.defineProperty(
      moduleSandbox,
      "createCollisionRules",
      {value: createCollisionRules, writable: false}
    );
    function createMovementRules (config) {
      if (config instanceof Array) {
        for (let i = config.length; i--;) {
          createMovementRule(config[i]);
        }
      } else if (arguments.length > 1) {
        for (let i = arguments.length; i--;) {
          createMovementRule(arguments[i]);
        }
      } else {
        for (let i in config) {
          if (!config.hasOwnProperty(i)) {
            continue;
          }
          config[i].name = i;
          createMovementRule(config[i]);
        }
      }
    }
    Object.defineProperty(
      moduleSandbox,
      "createMovementRules",
      {value: createMovementRules, writable: false}
    );
  }) ();
  function noop() { }
  function clarify(a) {
    switch (typeof a) {
      case "string":
        return "'" + a.replace("'", "\\'") + "'";
      case "number":
        return a.toString();
      default:
        return null;
    }
  }
  function aabb(c, x, y, w, h) {
    return (
      c.x + c.width > x &&
      c.y + c.height > y &&
      c.x < x + w &&
      c.y < y + h
    );
  }

  class RuleSheet {
    #dirty = false;
    #moveRule = {x:0,y:0};
    #mustFollow = false;
    constructor(game, key, callback) {
      this.game = game;
      this.key = key;
      this.absoluteKey = game.name + "\\" + key;
      this.defaultWidth = 1;
      this.defaultHeight = 1;
      this.hitboxPadding = 0;
      this.accX = 0.01;
      this.accY = 0.01;
      this.speedX = 0.1;
      this.speedY = 0.1;
      this.gravity = 0.2;
      this.friction = 0.9;
      this.static = true;
      this.resets = true;
      this.scan = true;
      this.moveX = noop;
      this.moveY = noop;
      this.collideX = noop;
      this.collideY = noop;
      this.collideRules = {
        bitmap: {},
        component: {}
      };
      this.bitmapX = noop;
      this.bitmapY = noop;
      this.tick = noop;
      this.display = noop;
      this.width = 1;
      this.height = 1;
      this.callback = callback;
      this.controls = {
        up: false,
        down: false,
        left: false,
        right: false
      };
      this.followKey = null;
      // Formerly private
      this.#moveRule = { x: 0, y: 0 };
      this.#dirty = false;
      this.#mustFollow = false;
    }
    dirty() {
      return this.#dirty;
    }
    set(config) {
      for (let i in config) {
        if (i in RuleSheet.setSndbx) {
          this[i] = (typeof config[i] === typeof RuleSheet.setSndbx[i]) ? config[i] : this[i];
        }
      }
      return this;
    }
    onhitItem(sheet, config) {
      let key;
      if (sheet instanceof RuleSheet) {
        key = sheet.key;
      } else {
        key = sheet;
        sheet = this.game.rulesheets[key];
      }
      let top, right, left, bottom, typ = typeof config;
      if (typ === "bigint") {
        top = config & bitmasks.collisions.top;
        right = config & bitmasks.collisions.right;
        bottom = config & bitmasks.collisions.bottom;
        left = config & bitmasks.collisions.left;
      } else if (typ === "object") {
        if ("self" in config) {
          typ = typeof config.self;
          if (typ === "bigint") {
            top = config.self & bitmasks.collisions.top;
            right = config.self & bitmasks.collisions.right;
            bottom = config.self & bitmasks.collisions.bottom;
            left = config.self & bitmasks.collisions.left;
          } else {
            top = config.self.top;
            right = config.self.right;
            bottom = config.self.bottom;
            left = config.self.left;
          }
          if ("that" in config && sheet instanceof RuleSheet) {
            sheet.onhit(this, config.that);
          }
        } else {
          top = config.top;
          right = config.right;
          bottom = config.bottom;
          left = config.left;
        }
      } else {
        throw "ACME_Rulesheet_Error: Failed to set collision for '" + key + "' on sheet '" + this.key + "': no collision data was provided.";
      }
      let scan = false;
      if (!(key in this.game.rulesheets)) {
        this.scan = true;
        scan = true;
      }
      this.collideRules[scan ? "bitmap" : "component"][key] = {
        top: top,
        right: right,
        bottom: bottom,
        left: left
      };
      this.#dirty = true;
      return this;
    }
    onhitItems(config) {
      for (let i in config) {
        if (config.hasOwnProperty(i)) {
          this.onhitItem(i, config[i]);
        }
      }
      return this;
    }
    onhit(a, b) {
      if (typeof a === "object" && arguments.length === 1) {
        this.onhitItems(a);
      } else {
        this.onhitItem(a, b);
      }
      return this;
    }
    follow(type) {
      this.static = false;
      this.#mustFollow = true;
      if (type instanceof RuleSheet) {
        this.followKey = type.key;
      } else {
        this.followKey = type;
      }
      this.#moveRule = {
        x: move_consts.FOLLOW_X,
        y: move_consts.FOLLOW_Y
      };
      this.tick = function ($component) {
        if (!$component.followee) {
          $component.ghost.x = $component.followee.x;
          $component.ghost.y = $component.followee.y;
          $component.ghost.width = $component.followee.width;
          $component.ghost.height = $component.followee.height;
        }
      };
      this.#dirty = true;
      return this;
    }
    movement(rule) {
      let typ = typeof rule;
      if (typ === "bigint") {
        this.#moveRule.x = rule & bitmasks.movement.x;
        this.#moveRule.y = rule & bitmasks.movement.y;
      } else if (typeof rule === "object") {
        if ("x" in rule) {
          this.#moveRule.x = rule.x;
        }
        if ("y" in rule) {
          this.#moveRule.y = rule.y;
        }
      } else {
        throw "ACME_Rulesheet_Error: Failed to set movement rules on rulesheet '" + this.key + "': no data provided.";
      }
      this.#dirty = true;
      this.static = false;
      return this;
    }
    compileBitmapCollision() {
      let args = "$component, $key, $x, $y, $width, $height";
      let xStr, yStr = "  switch ($key) {\n";
      xStr = yStr;
      let useX = false, useY = false, i, j, output = 0;
      for (i in this.collideRules.bitmap) {
        if (!this.collideRules.bitmap.hasOwnProperty(i)) {
          continue;
        }
        let rule = this.collideRules.bitmap[i];
        if (rule.top || rule.bottom) {
          useY = true;
          yStr += "    case " + clarify(i) + ":\n      " +
            "if ($component.y + $component.height * 0.5 < $y + $height * 0.5) {\n        ";
          switch (typeof rule.top) {
            case "string":
              yStr += rule.top + "\n        ";
              output |= 2;
              break;
            case "bigint":
              j = 0;
              while (rule.top > 0 && j < collisions.length) {
                if (rule.top & 1n) {
                  yStr += collisions[j] + "\n        ";
                }
                rule.top >>= 1n;
                j++;
              }
              output |= 2;
              break;
            case "function":
              yStr += "$component.code.collideRules.bitmap[$key].top($component, $key, $x, $y, $width, $height);\n        ";
              output |= 2;
              break;
          }
          yStr += "      } else {\n        ";
          switch (typeof rule.bottom) {
            case "string":
              yStr += rule.bottom + "\n        ";
              output |= 2;
              break;
            case "bigint":
              j = 0;
              while (rule.bottom > 0 && j < collisions.length) {
                if (rule.bottom & 1n) {
                  yStr += collisions[j] + "\n        ";
                }
                rule.bottom >>= 1n;
                j++;
              }
              output |= 2;
              break;
            case "function":
              yStr += "$component.code.collideRules.bitmap[$key].bottom($component, $key, $x, $y, $width, $height);\n        ";
              output |= 2;
              break;
          }
          yStr += "      }\n    break;";
        }
        if (rule.right || rule.left) {
          useX = true;
          xStr += "    case " + clarify(i) + ":\n      " +
            "if ($component.x + $component.width * 0.5 > $x + $width * 0.5) {\n        ";
          switch (typeof rule.right) {
            case "string":
              xStr += rule.right + "\n        ";
              output |= 1;
              break;
            case "bigint":
              j = 0;
              while (rule.right > 0 && j < collisions.length) {
                if (rule.right & 1n) {
                  xStr += collisions[j] + "\n        ";
                }
                rule.right >>= 1n;
                j++;
              }
              output |= 1;
              break;
            case "function":
              xStr += "$component.code.collideRules.bitmap[$key].right($component, $key, $x, $y, $width, $height);\n        ";
              output |= 1;
              break;
          }
          xStr += "      } else {\n        ";
          switch (typeof rule.left) {
            case "string":
              xStr += rule.left + "\n        ";
              output |= 1;
              break;
            case "bigint":
              j = 0;
              while (rule.left > 0 && j < collisions.length) {
                if (rule.left & 1n) {
                  xStr += collisions[j] + "\n        ";
                }
                rule.left >>= 1n;
                j++;
              }
              output |= 1;
              break;
            case "function":
              xStr += "$component.code.collideRules.bitmap[$key].left($component, $key, $x, $y, $width, $height);\n        ";
              output |= 1;
              break;
          }
          xStr += "      }\n    break;";
        }
      }
      if (useY) {
        yStr += "\n  }";
        this.bitmapY = Func(args, yStr);
      }
      if (useX) {
        xStr += "\n  }";
        this.bitmapX = Func(args, xStr);
      }
      return output;
    }
    compileMovement() {
      switch (typeof this.#moveRule.x) {
        case "string":
          this.moveX = Func("$component", this.#moveRule.x);
          break;
        case "function":
          this.moveX = this.#moveRule.x;
          break;
        case "bigint":
          let rule = this.#moveRule.x, j = 0, str = '';
          while (rule > 0 && j < movements.length) {
            if (rule & 1n) {
              str += movements[j] + "\n";
            }
            rule >>= 1n;
            j++;
          }
          this.moveX = Func("$component", str);
      }
      switch (typeof this.#moveRule.y) {
        case "string":
          this.moveY = Func("$component", this.#moveRule.y);
          break;
        case "function":
          this.moveY = this.#moveRule.y;
          break;
        case "bigint":
          let rule = this.#moveRule.y, j = 0, str = '';
          while (rule > 0 && j < movements.length) {
            if (rule & 1n) {
              str += movements[j] + "\n";
            }
            rule >>= 1n;
            j++;
          }
          this.moveY = Func("$component", str);
      }
    }
    compile() {
      if (!this.#dirty) {
        return this;
      }
      let collideX = "", collideY = "";
      let i, j, useX = false, useY = false, xStr, yStr = "  let $component = this;\n" +
        "for (let c = this.game.components.list, i = c.length; i --> 0;) {\n" +
        "  let $other = c[i];\n" +
        "  if (i === this.index || $other.dead) continue;\n" +
        "  let $key = $other.key,\n" +
        "      $x = $other.x,\n" +
        "      $y = $other.y,\n" +
        "      $width = $other.width,\n" +
        "      $height = $other.height;\n" +
        "  " + (this.#mustFollow ? "let d = $component.dsqTo($other);\n" +
          "  if (d < $component.ghost.dsq) {\n" +
          "    $component.followee = $other;\n" +
          "    $component.ghost.dsq = d;\n" +
          "  }" : "") + "\n" +
        "  if (\n" +
        "    $component.x + $component.width <  $x ||\n" +
        "    $component.y + $component.height < $y ||\n" +
        "    $component.x > $x + $width ||\n" +
        "    $component.y > $y + $height\n" +
        "  ) continue;\n" +
        "  switch ($key) {\n";
      xStr = yStr;
      for (i in this.collideRules.component) {
        if (!this.collideRules.component.hasOwnProperty(i)) {
          continue;
        }
        let rule = this.collideRules.component[i];
        if (rule.top || rule.bottom) {
          useY = true;
          yStr += "    case " + clarify(i) + ":\n      " +
            "if ($component.y + $component.height * 0.5 < $y + $height * 0.5) {\n        ";
          switch (typeof rule.top) {
            case "string":
              yStr += rule.top + "\n        ";
              break;
            case "bigint":
              j = 0;
              while (rule.top > 0 && j < collisions.length) {
                if (rule.top & 1n) {
                  yStr += collisions[j] + "\n        ";
                }
                rule.top >>= 1n;
                j++;
              }
              break;
            case "function":
              yStr += "$component.code.collideRules.component[$key].top($component, $key, $x, $y, $width, $height, $other);\n        ";
              break;
          }
          yStr += "      } else {\n        ";
          switch (typeof rule.bottom) {
            case "string":
              yStr += rule.bottom + "\n        ";
              break;
            case "bigint":
              j = 0;
              while (rule.bottom > 0 && j < collisions.length) {
                if (rule.bottom & 1n) {
                  yStr += collisions[j] + "\n        ";
                }
                rule.bottom >>= 1n;
                j++;
              }
              break;
            case "function":
              yStr += "$component.code.collideRules.component[$key].bottom($component, $key, $x, $y, $width, $height, $other);\n        ";
              break;
          }
          yStr += "      }\n    break;";
        }
        if (rule.right || rule.left) {
          useX = true;
          xStr += "    case " + clarify(i) + ":\n      " +
            "if ($component.x + $component.width * 0.5 > $x + $width * 0.5) {\n        ";
          switch (typeof rule.right) {
            case "string":
              xStr += rule.right + "\n        ";
              break;
            case "bigint":
              j = 0;
              while (rule.right > 0 && j < collisions.length) {
                if (rule.right & 1n) {
                  xStr += collisions[j] + "\n        ";
                }
                rule.right >>= 1n;
                j++;
              }
              break;
            case "function":
              xStr += "$component.code.collideRules.component[$key].right($component, $key, $x, $y, $width, $height, $other);\n        ";
              break;
          }
          xStr += "      } else {\n        ";
          switch (typeof rule.left) {
            case "string":
              xStr += rule.left + "\n        ";
              break;
            case "bigint":
              j = 0;
              while (rule.left > 0 && j < collisions.length) {
                if (rule.left & 1n) {
                  xStr += collisions[j] + "\n        ";
                }
                rule.left >>= 1n;
                j++;
              }
              break;
            case "function":
              xStr += "$component.code.collideRules.component[$key].left($component, $key, $x, $y, $width, $height, $other);\n        ";
              break;
          }
          xStr += "      }\n    break;";
        }
      }
      xStr += "    }\n  }\n  ";
      yStr += "    }\n  }\n  ";
      if (this.scan) {
        collideX += "  this.scanBitmapX ();\n";
        collideY += "  this.scanBitmapY ();\n";
        i = this.compileBitmapCollision();
        useX = useX || (i & 1);
        useY = useY || (i & 2);
      }
      collideX += xStr;
      collideY += yStr;
      if (useX) {
        this.collideX = Func(collideX);
      }
      if (useY) {
        this.collideY = Func(collideY);
      }
      this.compileMovement();
      this.#dirty = false;
      this.game.compilingBegun = true;
      return this;
    }

    static setSndbx = {
      defaultWidth: 1,
      defaultHeight: 1,
      hitboxPadding: 0,
      accX: 0.01,
      accY: 0.01,
      speedX: 0.1,
      speedY: 0.1,
      gravity: 0.2,
      friction: 0.9,
      width: 1,
      height: 1,
      static: false,
      scan: false,
      resets: true,
      tick: noop,
      display: noop
    }
  }
  // Bind the RuleSheet constructor to the moudle sandbox
  Object.defineProperty(
    moduleSandbox,
    "rulesheet_constructor",
    { value: RuleSheet, writable: false }
  );

  class Component {
    constructor(game) {
      this.dead = false;
      this.game = game;
      this.resetsWithRest = false;
    }
    init(x, y, type) {
      if (!this.game.rulesheets.hasOwnProperty(type)) {
        throw "ACME_Component_Error: No rulesheet of type \"" + type + "\" exists for the game \"" + this.game.name + "\"";
      }
      this.key = type;
      this.code = this.game.rulesheets[type];
      this.x = this.originX = x;
      this.y = this.originY = y;
      this.width = this.originW = this.code.width;
      this.height = this.originH = this.code.height;
      this.velX = this.velY = 0;
      this.accX = this.code.accX;
      this.accY = this.code.accY + this.code.gravity;
      this.speedX = this.code.speedX;
      this.speedY = this.code.speedY;
      this.gravity = this.code.gravity;
      this.friction = this.code.friction;
      this.dead = false;
      this.health = 100;
      this.flag0 = this.flag1 = this.flag2 = this.flag3 = false;
      this.onDestroy = this.code.onDestroy ?? noop;
      this.canJump = false;
      this.moveX = this.code.moveX;
      this.moveY = this.code.moveY;
      this.collideX = this.code.collideX;
      this.collideY = this.code.collideY;
      this.bitmapX = this.code.bitmapX;
      this.bitmapY = this.code.bitmapY;
      this.controls = this.code.controls;
      this.followee = null;
      this.ghost = { x: 0, y: 0, width: 0, height: 0 };
      this.resetsWithRest = this.code.resets;
      this.graphics = this.code.graphics;
      this.code.callback(this, x, y, type);
    }
    reset() {
      this.x = this.originX;
      this.y = this.originY;
      this.width = this.originW;
      this.height = this.originH;
      this.dead = false;
      this.health = 100;
      this.velX = this.velY = 0;
      this.flag0 = this.flag1 = this.flag2 = this.flag3 = false;
      this.canJump = false;
      this.target = null;
      this.ghost.x = this.ghost.y = this.ghost.width = this.ghost.height = 0;
    }
    update() {
      this.code.tick(this);
      this.moveY(this);
      this.y += this.velY;
      this.collideY(this);
      if (this.dead || this.health <= 0) {
        this.onDestroy(this);
        return +(this.dead = true);
      }
      this.moveX(this);
      this.x += this.velX;
      this.collideX(this);
      if (this.health <= 0) {
        this.dead = true;
      }
      if (this.dead) {
        this.onDestroy(this);
      }
      return +this.dead;
    }
    display() {
      let camera = this.game.camera;
      this.graphics(
        this,
        (this.x - camera.x) * camera.scaleX,
        (this.y - camera.y) * camera.scaleY,
        this.width * camera.scaleX,
        this.height * camera.scaleY
      );
    }
    manage() {
      this.update();
      this.display();
    }
    scanBitmapX() {
      let level = this.game.level, minX = Math.max(Math.floor(this.x), 0), maxX = Math.min(Math.ceil(this.x + this.width), level.width), minY = Math.max(Math.floor(this.y), 0), maxY = Math.min(Math.ceil(this.y + this.height), level.height), ix, iy, d;
      for (iy = minY; iy < maxY; iy++) {
        for (ix = minX; ix < maxX; ix++) {
          d = level.data[iy][ix];
          if (aabb(this, ix, iy, 1, 1)) {
            this.bitmapX(this, d, ix, iy, 1, 1);
            if (this.dead || this.health <= 0) {
              return +(this.dead = true);
            }
          }
        }
      }
      return 0;
    }
    scanBitmapY() {
      let level = this.game.level, minX = Math.max(Math.floor(this.x), 0), maxX = Math.min(Math.ceil(this.x + this.width), level.width), minY = Math.max(Math.floor(this.y), 0), maxY = Math.min(Math.ceil(this.y + this.height), level.height), ix, iy, d;
      for (iy = minY; iy < maxY; iy++) {
        for (ix = minX; ix < maxX; ix++) {
          d = level.data[iy][ix];
          if (aabb(this, ix, iy, 1, 1)) {
            this.bitmapY(this, d, ix, iy, 1, 1);
            if (this.dead || this.health <= 0) {
              return +(this.dead = true);
            }
          }
        }
      }
      return 0;
    }
    goRight() { this.velX = linear(this.velX, this.speedX, this.accX); }
    goLeft() { this.velX = linear(this.velX, -this.speedX, this.accX); }
    slowX() { this.velX *= this.friction; }
    slowY() { this.velY *= this.friction; }
    jump() {
      this.velY = -Math.sign(this.gravity) * this.speedY;
      this.canJump = false;
    }
    fall() {
      this.velY = linear(this.velY, this.speedY * Math.sign(this.gravity), this.gravity);
    }
    goUp() { this.velY = linear(this.velY, -this.speedY, this.accY); }
    goDown() { this.velY = linear(this.velY, this.speedY, this.accY); }
    blockX(x, y, w, h) {
      if (this.x < x) {
        this.x = x - this.width;
      } else {
        this.x = x + w;
      }
    }
    blockY(x, y, w, h) {
      if (this.y < y) {
        this.y = y - this.height;
      } else {
        this.y = y + h;
      }
    }
    destroy() { this.dead = true; this.onDestroy(); }
  }

  // Bind the component constructor to the module sandbox
  Object.defineProperty(
    moduleSandbox,
    "component_constructor",
    { value: Component, writable: false }
  );
  class Camera {
    constructor(config, game) {
      this.game = game;
      this.followee = null;
      this.followType = null;
      this.shadow = {
        x: 0,
        y: 0,
        width: 1,
        height: 1
      };
      this.mode = config["camera-mode"] ?? config.cameraMode ?? "free";
      this.movement = config["camera-movement-function"] ?? config.camerMovementFunction ?? "lerp";
      this.speed = config["camera-speed"] ?? config.cameraSpeed ?? 0.2;
      this.deltaX = this.x = 0;
      this.deltaY = this.y = 0;
      this.scaleX = (config["camera-width"] ?? config.cameraWidth) / config.viewportWidth ?? (config["block-size"] ?? config.blockSize);
      this.scaleY = (config["camera-height"] ?? config.cameraHeight) / config.viewportHeight ?? (config["block-size"] ?? config.blockSize);
      this.width = (config["camera-width"] ?? config.cameraWidth) / this.scaleX ?? config.viewportWidth;
      this.height = (config["camera-height"] ?? config.cameraHeight) / this.scaleY ?? config.viewportHeight;
      this.ready = false;
    }
    follow(c) {
      if (c instanceof Component) {
        this.followee = c;
      } else if (c instanceof RuleSheet) {
        this.followType = c.key;
      } else if (typeof c === "string" || typeof c === "number") {
        this.followType = c in this.game.rulesheets ? c : null;
      }
    }
    reset() {
      if (!this.followee || this.followee.dead) {
        this.followee = this.shadow;
      }
      this.x = this.followee.x;
      this.y = this.followee.y;
    }
    isClose(thresh) {
      return sq(this.deltaX - this.shadow.x) + sq(this.deltaY - this.shadow.y) < thresh * thresh;
    }
    update() {
      if (!this.followee || this.followee.dead) {
        this.followee = this.shadow;
      } else {
        this.shadow.x = this.followee.x;
        this.shadow.y = this.followee.y;
      }
      switch (this.movement) {
        case "lerp":
          this.deltaX = lerp(
            this.deltaX,
            this.followee.x + (this.followee.width - this.width) * 0.5,
            this.speed
          );
          this.deltaY = lerp(
            this.deltaY,
            this.followee.y + (this.followee.height - this.height) * 0.5,
            this.speed
          );
          break;
        case "linear":
          this.deltaX = linear(
            this.deltaX,
            this.followee.x + (this.followee.width - this.width) * 0.5,
            this.speed
          );
          this.deltaY = linear(
            this.deltaY,
            this.followee.y + (this.followee.height - this.height) * 0.5,
            this.speed
          );
          break;
      }
      switch (this.mode) {
        case "bound":
          if (this.game.level.width <= this.width) {
            this.x = this.game.level.width * 0.5;
          } else {
            this.x = constrain(this.deltaX - this.width * 0.5, this.width * 0.5, this.game.level.width - this.width * 0.5);
          }
          if (this.game.level.height <= this.height) {
            this.y = this.game.level.height * 0.5;
          } else {
            this.y = constrain(this.deltaX - this.height * 0.5, this.height * 0.5, this.game.level.height - this.height * 0.5);
          }
          break;
        default:
          this.x = this.deltaX;
          this.y = this.deltaY;
      }
    }
    display() {
      let level = this.game.level, graphics = this.game.graphics, minX = Math.max(Math.floor(this.x), 0), minY = Math.max(Math.floor(this.y), 0), maxX = Math.min(Math.ceil(this.x + this.width), level.width), maxY = Math.min(Math.ceil(this.y + this.height), level.height);
      for (let ty = minY; ty < maxY; ty++) {
        for (let tx = minX; tx < maxX; tx++) {
          graphics(
            level.data[ty][tx],
            (tx - this.x) * this.scaleX,
            (ty - this.y) * this.scaleY,
            this.scaleX,
            this.scaleY
          );
        }
      }
    }
    manage() {
      this.update();
      this.display();
    }
  }

  // Bind the camera constructor to the module sandbox
  Object.defineProperty(
    moduleSandbox,
    "camera_constructor",
    { value: Camera, writable: false }
  );
  class Pool {
    constructor(game) {
      this.list = [];
      this.length = 0;
      this.game = game;
    }
    recycle() {
      let i = this.length, n;
      while (i--) {
        n = this.list[i];
        if (n.dead) {
          n.init.apply(n, arguments);
          if (typeof n.code.oncreate === "function") {
            n.code.oncreate(n);
          }
          return n;
        }
      }
      n = new Component(this.game);
      n.index = this.length++;
      n.init.apply(n, arguments);
      if (typeof n.code.oncreate === "function") {
        n.code.oncreate(n);
      }
      this.list.push(n);
      return n;
    }
    manage(update) {
      let i = this.length, n;
      while (i--) {
        n = this.list[i];
        if (n.dead) {
          continue;
        }
        void (update && n.update());
        n.display();
      }
    }
    resetAll() {
      let i = this.length, n;
      while (i--) {
        n = this.list[i];
        if (n.resetsWithRest) {
          n.reset();
        } else {
          n.dead = true;
        }
      }
    }
    destroyAll() {
      let i = this.length, n;
      while (i--) {
        n = this.list[i];
        n.dead = true;
      }
    }
    itemAt(i) {
      return i < 0 ? null : i >= this.length ? null : this.list[i];
    }
    forEach(f) {
      let i = 0, l = this.length, n;
      for (; i < l; i++) {
        n = this.list[i];
        if (n.dead) { continue; }
        f(n, i, this);
      }
    }
  }

  // Push to the module sandbox
  Object.defineProperty(
    moduleSandbox,
    "pool_constructor",
    { value: Pool, writable: false }
  );
  class Game {
    constructor(config) {
      this.components = new Pool(this);
      this.camera = new Camera(config, this);
      this.rulesheets = {};
      this.name = config.name;
      this.paused = true;
      this.compilingBegun = false;
      this.active = false;
      this.graphics = noop;
      this.level = {
        data: [],
        width: 0,
        height: 0
      };
      (this.init ?? noop)(config);
      // Boolean flags to delay loading/resetting
      // to minimize game logic conflicts
      this.$lazyReset = false;
      this.$lazyLoad = false;
      this.$lazyLevel = null;
    }
    static guessFormat(config) {
      let bitmap = config.data = config.bitmap ?? config.data ?? config.level ?? [];
      if (typeof bitmap === "string") {
        return "string";
      } else if (bitmap instanceof __TypedArray ||
        bitmap instanceof root.Uint8Array ||
        bitmap instanceof root.Int16Array) {
        return "number[]";
      } else if (bitmap instanceof Array) {
        if (!bitmap.length) {
          return "none";
        } else if (bitmap[0] instanceof Array) {
          return (typeof bitmap[0][0]) + "[][]";
        } else {
          return (typeof bitmap[0]) + "[]";
        }
      }
      return "none";
    }
    parseLevel(config, destination) {
      let x, y, i, l, c, w, h, row, $comp;
      destination = destination ?? {
        width: 0,
        height: 0,
        data: []
      };
      this.components.destroyAll();
      destination.data.length = 0;
      sticks: switch (config.format) {
        case "string":
        case "char[]":
        case "number[]":
        case "int[]":
          if (config.hasOwnProperty("width")) {
            throw "ACME_Level_Error: A \"" + config.format + "\" level string MUST contain a width property!";
          }
          l = config.data.length;
          w = destination.width = config.width;
          h = destination.height = config.height ?? (l / w | 0);
          for (y = 0; y < h; y++) {
            row = [];
            row.length = w;
            destination.data.push(row);
            for (x = 0; x < w; x++) {
              i = x + y * w;
              if (i > l) {
                break sticks;
              }
              c = config.data[i];
              if (c in this.rulesheets) {
                $comp = this.components.recycle(x, y, c);
                if (this.camera.followType === c) {
                  this.camera.follow($comp);
                }
              }
              row[i] = c;
            }
          }
          break;
        case "string[]":
        case "char[][]":
        case "number[][]":
        case "int[][]":
          h = destination.height = config.height ?? config.data.length;
          w = 0;
          for (y = 0; y < h; y++) {
            row = [];
            destination.data.push(row);
            l = config.data[y].length;
            w = config.width ?? Math.max(l, w);
            for (x = 0; x < w; x++) {
              if (x >= l) {
                break;
              }
              c = config.data[y][x];
              if (c in this.rulesheets) {
                $comp = this.components.recycle(x, y, c);
                if (this.camera.followType === c) {
                  this.camera.follow($comp);
                }
              }
              row[x] = c;
            }
          }
          if (w !== config.width) {
            destination.width = w;
            for (y = 0; y < h; y++) {
              row = destination.data[y];
              row.length = w;
            }
          }
          break;
        case "cmd":
          c = '';
          w = 0;
          h = '';
          for (i = 0; i < config.data.length; i++) {
            if (w === 0) {
              c = config.data[i];
              w++;
            } else if (config.data[i] === ",") {
              if (w === 1) {
                x = parseFloat(h);
                h = '';
              } else {
                y = parseFloat(h);
                $comp = this.components.recycle(x, y, c);
                if (this.camera.followType === c) {
                  this.camera.follow($comp);
                }
                h = '';
                c = '';
                w = 0;
              }
            } else {
              h += config.data[i];
            }
          }
          destination.data.push([]);
          destination.width = 0;
          destination.height = 0;
          break;
        case "cmd[]":
          for (i = 0; i < config.data.length; i++) {
            c = config.data[i];
            this.components.recycle(c[1], c[2], c[0]);
          }
          destination.data.push([]);
          destination.width = 0;
          destination.height = 0;
          break;
      }
      this.camera.reset();
      return destination;
    }
    createRulesheet(char, callback) {
      if (char in this.rulesheets) {
        return this.rulesheets[char];
      }
      let e = new RuleSheet(this, char, callback ?? noop);
      this.rulesheets[char] = templates[e.absoluteKey] = e;
      if (exports.strictMode && this.compilingBegun) {
        throw "ACME_RuleSheet_Error: A rulesheet from game \"" + this.name + "\" was compiled before the creation of rulesheet \"" + char + "\".  This could cause collisions with \"" + char + "\" to be interpreted as bitmap (static) collisions.";
      }
      return e;
    }
    borrowRulesheet(game, char, alias) {
      let e = new RuleSheet(this, alias ?? char), o = game.rulesheets[char], i;
      if (o.dirty) {
        throw "ACME_RuleSheet_Error: Rulesheet \"" + char + "\" from Game \"" + game.name + "\" is tainted, and must be compiled before duplication.";
      }
      for (i in o) {
        e[i] = o[i];
      }
      return e;
    }
    $load() {
      if (!("format" in this.$lazyLevel)) {
        this.$lazyLevel.format = Game.guessFormat(this.$lazyLevel);
      }
      this.parseLevel(this.$lazyLevel, this.level);
      this.$lazyLoad = false;
      this.$lazyLevel = null;
    }
    load(data) {
      this.$lazyLoad = true;
      this.$lazyLevel = data;
      this.$lazyReset = false;
    }
    $reset() {
      this.components.resetAll();
      this.$lazyReset = false;
    }
    reset() {
      this.$lazyReset = true;
    }
    spawn(a, b, c, d, e) {
      return this.components.recycle(a, b, c, d, e);
    }
    pause() {
      this.paused = true;
    }
    resume() {
      this.paused = false;
    }
    blur() {
      this.active = false;
      this.pause();
    }
    focus() {
      this.active = true;
      this.resume();
    }
    manage() {
      if (this.active) {
        if (this.$lazyLoad) {
          this.$load();
        }
        if (this.$lazyReset) {
          this.$reset();
        }
        if (this.paused) {
          if (typeof this.pauseScreen === "function") {
            this.pauseScreen();
          }
        } else {
          this.camera.update();
        }
        this.camera.display();
        this.components.manage(!this.paused);
      }
    }
  }

  // Push the Game constructor to the module sandbox
  Object.defineProperty(
    moduleSandbox,
    "game_constructor",
    { value: Game, writable: false }
  );
  function init(config) {
    let i;
    config = config ?? {};
    exports.strictMode = config.strictMode ?? exports.strictMode;
    for (i in dependencies) {
      if (!dependencies[i]) {
        throw "ACME_Import_Error: Module \""+i+"\" is required, but was not loaded";
      }
    }
    for (i in modules) {
      if (typeof modules[i].init === "function") {
        modules[i].init(config);
      }
    }
    initialized = true;
    exports.constants = {};
    for (i in move_consts) {
      exports.constants[i] = move_consts[i];
      if (dumpConsts) {
        root[i] = root[i] ?? move_consts[i];
      }
    }
    for (i in coll_consts) {
      exports.constants[i] = coll_consts[i];
      if (dumpConsts) {
        root[i] = root[i] ?? coll_consts[i];
      }
    }

  }
  exports.init = init;
  function createGame(config) {
    if (!config.name) {
      throw "ACME_Game_Error: Games MUST be named.";
    }
    if (!initialized) {
      init();
    }
    return (games[config.name] = new Game(config));
  }
  exports.createGame = createGame;
  // Attach internal objects
  Object.defineProperties(moduleSandbox, {
    "rulesheet_pool": { value: templates, writable: false },
    "game_pool": { value: games, writable: false },
    "movement_standards": { value: movements, writable: false },
    "collision_standards": { value: collisions, writable: false },
    "dependencies": { value: dependencies, writable: false },
    "movement_constants": { value: move_consts, writable: false },
    "collision_constants": { value: coll_consts, writable: false },
  });
  function host(f) {
    let initialize = f.bind(moduleSandbox);
    let module = initialize() ?? {},
        name = module.name ?? "acme_mod_" + Date.now().toString(36);
    modules[name] = module;
    if ("include" in module && module.include instanceof Array) {
      module.include.forEach(function (s) {
        s = s.toString();
        if (!dependencies[s]) {
          dependencies[s] = false;
        }
      });
    }
    dependencies[name] = true;
    initialized = false;
    return module;
  }
  exports.host = host;
  exports.strictMode = true;
  exports.games = games;

  exports.host(function () {
    // The module sandbox
    let binding = this;
    // NONE
    binding.createCollisionRule({
      value: 0,
      name: "none",
      code: ""
    });
    binding.editCollisionBitmasks({
      top: ["none"],
      right: ["none"],
      bottom: ["none"],
      left: ["none"]
    });
    // BLOCK, STOP, REVERSE, BOUNCE
    binding.createCollisionRules(
      {name: "block_top", code: "$component.y = $y - $component.height;"},
      {name: "block_right", code: "$component.x = $x + $width;"},
      {name: "block_bottom", code: "$component.y = $y + $height;"},
      {name: "block_left", code: "$component.x = $x - $component.width;"},
      {name: "stop_top", code: "$component.velY = 0;"},
      {name: "stop_right", code: "$component.velX = 0;"},
      {name: "stop_bottom", code: "$component.velY = 0;"},
      {name: "stop_left", code: "$component.velX = 0;"},
      {name: "reverse_top", code: "$component.velY *= -1;"},
      {name: "reverse_right", code: "$component.velX *= -1;"},
      {name: "reverse_bottom", code: "$component.velY *= -1;"},
      {name: "reverse_left", code: "$component.velX *= -1;"},
      {name: "bounce_top", code: "$component.velY = -$component.speedY;"},
      {name: "bounce_right", code: "$component.velX = $component.speedX;"},
      {name: "bounce_bottom", code: "$component.velY = $component.speedY;"},
      {name: "bounce_left", code: "$component.velX = -$component.speedX;"}
    );
    // Side names for repeated constants
    let sides = ["top", "right", "bottom", "left"];
    // Repeated constant names
    let names = [
      "destroy",
      "harm",
      "flag_0",
      "flag_1",
      "flag_2",
      "flag_3",
      "can_jump",
      "block",
      "stop",
      "reverse",
      "bounce"
    ];
    // Repeated code
    let codes = [
      "$component.dead = true;",
      "$component.health -= 10;",
      "$component.flag0 = true;",
      "$component.flag1 = true;",
      "$component.flag2 = true;",
      "$component.flag3 = true;",
      "$component.canJump = true;"
    ];
    // Append all collision constants to ACME's bitmasking lists
    for (let i = 0; i < names.length; i++) {
      if (i < codes.length) {
        for (let j = 0; j < 4; j++) {
          binding.createCollisionRule({
            name: names[i] + "_" + sides[j],
            code: codes[i]
          });
        }
      }
      binding.createCollisionShorthand({
        name: names[i] + "_x",
        rules: [names[i] + "_left", names[i] + "_right"]
      });
      binding.createCollisionShorthand({
        name: names[i] + "_y",
        rules: [names[i] + "_top", names[i] + "_bottom"]
      });
      binding.createCollisionShorthand({
        name: names[i],
        rules: [names[i] + "_x", names[i] + "_y"]
      });
      binding.editCollisionBitmasks({
        top: [names[i] + "_top"],
        right: [names[i] + "_right"],
        bottom: [names[i] + "_bottom"],
        left: [names[i] + "_left"]
      });
    }
    // PLATFORM
    binding.createCollisionShorthand({
      name: "platform",
      rules: ["block", "stop", "can_jump_top"]
    });
    // DEFAULT, FRICTION, GRAVITY, MARCH, PATROL, FOLLOW
    binding.createMovementRules([
      {
        name: "default_y",
        code: "if($component.controls.up())this.gravity?this.canJump?this.jump():0:this.goUp();if($component.controls.down())this.goDown();"
      },
      {
        name: "default_x",
        code: "if($component.controls.left())this.goLeft();if($component.controls.right())this.goRight();"
      },
      {
        name: "friction_x",
        code: "$component.slowX();"
      },
      {
        name: "friction_y",
        code: "$component.slowY();"
      },
      {
        name: "gravity",
        code: "$component.fall();"
      },
      {
        name: "march_x",
        code: "if(Math.abs($component.velX) < $component.speedX)$componet.velX = $component.speedX;"
      },
      {
        name: "march_y",
        code: "if(Math.abs($component.velY)<$component.speedY)$componet.velX = $component.speedX;"
      },
      {
        name: "patrol_x",
        code: "if (Math.abs(this.x - this.originX) >= 5) this.velX *= -1;"
      },
      {
        name: "patrol_y",
        code: "if (Math.abs(this.y - this.originY) >= 5) this.velY *= -1;"
      },
      {
        name: "follow_x",
        code: "if ($component.x + $component.width < $component.ghost.x) $component.goRight(); else if ($component.x > $component.ghost.x + $component.ghost.width) $component.goRight(); else $component.slowX();"
      },
      {
        name: "follow_y",
        code: "if ($component.y + $component.height < $component.ghost.y)this.gravity?this.canJump?this.jump():0:this.goUp());else if(!$component.gravity) {if ($component.y > $component.ghost.y + $component.ghost.height) $component.goDown(); else $component.slowY();}"
      },
    ]);
    // Shorthands
    binding.createMovementShorthand({
      name: "default",
      rules: ["default_x", "default_y"]
    });
    binding.createMovementShorthand({
      name: "friction",
      rules: ["friction_x", "friction_y"]
    });
    binding.createMovementShorthand({
      name: "march",
      rules: ["march_x", "march_y"]
    });
    binding.createMovementShorthand({
      name: "patrol",
      rules: ["patrol_x", "patrol_y"]
    });
    binding.createMovementShorthand({
      name: "follow",
      rules: ["follow_x", "follow_y"]
    });
    // Append all movement constants to ACME's bitmasks
    binding.editMovementBitmasks({
      x: ["default_x", "friction_x", "march_x", "patrol_x", "follow_x"],
      y: ["default_y", "friction_y", "march_y", "patrol_y", "follow_y", "gravity"],
    });
    void (/\*/);
    // Module name:
    return {name: "ACME_Defaults"};
  });
  // 2000+ lines of code & documentation
  return root.ACME = exports;
}) ();
