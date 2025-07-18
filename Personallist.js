/*:
 * @plugindesc Custom “Personals” menu that displays NPC data in the player’s menu. – v1.2
 * @author Kristof Soczo
 *
 * @param menuTitle
 * @text Menu Window Title
 * @type string
 * @default Personals
 *
 * @param enableInitial
 * @text Initially Enabled
 * @type boolean
 * @on Enabled
 * @off Disabled
 * @desc Controls whether the menu is accessible by default. (If Disabled, only plugin commands can toggle it.)
 * @default true
 *
 * @param openMenuKey
 * @text Open Menu Key
 * @type string
 * @default pageup
 * @desc The key name used to open the Personals menu directly (e.g. "pageup", "pagedown", "F5").
 *
 * @help
 *
 * === Plugin Commands ===
 * EnablePersonalMenu
 *     Enables the Personals menu.
 * DisablePersonalMenu
 *     Disables the Personals menu.
 * AddPersonalToList
 *     Adds all NPCs defined in the current event’s comments to the list.
 * AddPersonalToList <id1> <id2> …
 *     Finds the NPCs with the given IDs across all events and adds or updates them.
 * RemovePersonalFromList
 *     Removes all NPCs defined in the current event’s comments.
 * RemovePersonalFromList <id1> <id2> …
 *     Removes the NPCs with the given IDs from the list.
 *
 * === Script Calls ===
 * $gameSystem.isPersonalAdded(<id>)
 *     Returns true if the NPC with the given ID is currently in the player’s list.
 *
 * === NPC Definition in Event Comments ===
 * In order for AddPersonalToList to pick up an NPC, your event page must include comment lines like this:
 *
 *   Type: NPC
 *   ID: 1
 *   Name: John, the Innkeeper
 *   Category: Bartender
 *   Face: Actor1, 3
 *   Icon: 1,2,3 (max 3 icons)
 *   Details: John has served travelers for years,
 *            and always has a story to tell.
 *
 * You can split a single NPC’s data across multiple comment blocks if you run out of space.
 * Just make sure each block begins with both:
 *   Type: NPC
 *   ID: <same NPC ID>
 *
 * The order of lines doesn’t matter, but “Type: NPC” and “ID:” must be present in each block.
 * === Version 1.2 ===
 *
 * Changelog:
 *  • Added bulk operations: you can now call
 *      AddPersonalToList <id1> <id2> <id3> …
 *      RemovePersonalFromList <id1> <id2> …
 *    to add or remove multiple NPCs in one command.
 *  • RemovePersonalFromList with no arguments will now remove all NPCs defined
 *    in the current event page, even if no ID is supplied.
 */

(() => {
  const pluginName = "Personallist";
  const parameters = PluginManager.parameters(pluginName);
  const PERSONAL_MENU_NAME = parameters["menuTitle"] || "Personals";
  const enableInitial = parameters["enableInitial"] === "true";
  const openMenuKey = (parameters["openMenuKey"] || "q").toLowerCase();
  const PERSONAL_KEY = "personalMenu";

  // ============================================================================
  //  DATA PROCUREMENT
  // ============================================================================
  const getPersonalList = function () {
    if (!$gameSystem._personalList) {
      $gameSystem._personalList = [];
    }
    return $gameSystem._personalList;
  };

  function parseNpcBlocks(list, wantedId = null) {
    const results = [];
    let npc = null;
    let readingNote = false;

    const pushCurrent = () => {
      if (npc && npc.typeIsNPC && npc.name && npc.id) {
        if (!wantedId || npc.id === wantedId) results.push({ ...npc });
      }
    };

    list.forEach((cmd) => {
      if (cmd.code !== 108 && cmd.code !== 408) {
        readingNote = false;
        return;
      }
      const line = cmd.parameters[0].trim();

      if (line.startsWith("Type:") && line.includes("NPC")) {
        pushCurrent();
        npc = {
          typeIsNPC: true,
          id: "",
          name: "",
          category: "",
          faceName: "",
          faceIndex: 0,
          iconIndexes: [],
          notes: "",
        };
        readingNote = false;
        return;
      }

      if (!npc) return;

      if (line.startsWith("ID:")) npc.id = line.slice(3).trim();
      else if (line.startsWith("Name:")) npc.name = line.slice(5).trim();
      else if (line.startsWith("Category:"))
        npc.category = line.slice(9).trim();
      else if (line.startsWith("Face:")) {
        const [fn, fi] = line.slice(5).split(",");
        npc.faceName = (fn || "").trim();
        npc.faceIndex = parseInt(fi || "0", 10);
      } else if (line.startsWith("Icon:")) {
        npc.iconIndexes = line
          .slice(5)
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
          .slice(0, 3);
      } else if (line.startsWith("Details:")) {
        npc.notes = line.slice(8).trim();
        readingNote = true;
      } else if (readingNote) {
        npc.notes += "\n" + line;
      }
    });

    pushCurrent();
    return results;
  }

  // ────────────────────────────────────────────
  // 1) BUTTON REGISTRATION
  // ────────────────────────────────────────────
  if (openMenuKey.length === 1) {
    // pl. 'q' -> Q (81)
    const code = openMenuKey.toUpperCase().charCodeAt(0);
    Input.keyMapper[code] = PERSONAL_KEY;
  } else {
    Input.keyMapper[Input.stringToSymbol(openMenuKey)] = PERSONAL_KEY;
  }

  // ============================================================================
  //  PLUGIN COMMANDS
  // ============================================================================
  const _Game_Interpreter_pluginCommand =
    Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);

    if (command === "EnablePersonalMenu") {
      $gameSystem._personalMenuEnabled = true;
      return;
    }
    if (command === "DisablePersonalMenu") {
      $gameSystem._personalMenuEnabled = false;
      return;
    }

    if (command === "RemovePersonalFromList") {
      const removeId = (idToDel) => {
        idToDel = String(idToDel);
        const before = getPersonalList().length;
        $gameSystem._personalList = getPersonalList().filter(
          (i) => i.id !== idToDel
        );
        if (getPersonalList().length !== before) {
          $gameSystem._triggerPersonalRemoved(idToDel);
        }
      };

      if (args.length) {
        args.forEach(removeId);
        return;
      }

      const ev = $gameMap.event(this.eventId());
      const page = ev && ev.event().pages[ev._pageIndex];
      if (!page || !page.list) return;

      parseNpcBlocks(page.list).forEach((npcObj) => removeId(npcObj.id));
      return;
    }

    if (command === "AddPersonalToList") {
      const upsert = (npc) => {
        const list = getPersonalList();
        const existing = list.find((i) => i.id === npc.id);
        if (existing) Object.assign(existing, npc); // update
        else {
          list.push(npc); // insert
          $gameSystem._triggerPersonalAdded(npc.id);
        }
        if (npc.faceName) ImageManager.loadFace(npc.faceName);
      };

      if (args.length) {
        args.forEach((targetId) => {
          targetId = String(targetId);
          $gameMap.events().forEach((ev) => {
            const page = ev.event().pages[ev._pageIndex];
            if (page && page.list) {
              parseNpcBlocks(page.list, targetId).forEach(upsert);
            }
          });
        });
        return;
      }

      const ev = $gameMap.event(this.eventId());
      const page = ev && ev.event().pages[ev._pageIndex];
      if (!page || !page.list) return;

      parseNpcBlocks(page.list).forEach(upsert);
    }
  };

  // ============================================================================
  //  MENU CALCULATION
  // ============================================================================
  const _Window_MenuCommand_addOriginalCommands =
    Window_MenuCommand.prototype.addOriginalCommands;

  Window_MenuCommand.prototype.addOriginalCommands = function () {
    _Window_MenuCommand_addOriginalCommands.call(this);

    if ($gameSystem._personalMenuEnabled === undefined) {
      $gameSystem._personalMenuEnabled = enableInitial;
    }

    if ($gameSystem._personalMenuEnabled) {
      this.addCommand(PERSONAL_MENU_NAME, "personalList", true);
    }
  };

  // ============================================================================
  // MANU HANDLER
  // ============================================================================
  const _Scene_Menu_createCommandWindow =
    Scene_Menu.prototype.createCommandWindow;
  Scene_Menu.prototype.createCommandWindow = function () {
    _Scene_Menu_createCommandWindow.call(this);
    this._commandWindow.setHandler(
      "personalList",
      this.commandPersonalList.bind(this)
    );
  };

  Scene_Menu.prototype.commandPersonalList = function () {
    SceneManager.push(Scene_PersonalList);
  };

  // ============================================================================
  // Scene_PersonalList
  // ============================================================================
  function Scene_PersonalList() {
    Scene_MenuBase.call(this);
  }

  Scene_PersonalList.prototype = Object.create(Scene_MenuBase.prototype);
  Scene_PersonalList.prototype.constructor = Scene_PersonalList;

  Scene_PersonalList.prototype.create = function () {
    Scene_MenuBase.prototype.create.call(this);
    this._titleWindow = new Window_PersonalTitle();
    this.addWindow(this._titleWindow);

    const titleHeight = this._titleWindow.height;
    const tempWindow = new Window_Base(0, 0, 0, 0);
    const headerHeight = tempWindow.fittingHeight(3);
    const contentHeight = Graphics.boxHeight - titleHeight - headerHeight;

    this._listWindow = new Window_PersonalList(
      0,
      titleHeight,
      300,
      contentHeight + headerHeight
    );
    this._listWindow.setHandler("ok", this.onItemOk.bind(this));
    this._listWindow.setHandler("cancel", this.popScene.bind(this));
    this.addWindow(this._listWindow);

    this._headerWindow = new Window_PersonalHeader(
      300,
      titleHeight,
      Graphics.boxWidth - 300,
      headerHeight
    );
    this.addWindow(this._headerWindow);

    this._descWindow = new Window_PersonalDesc(
      300,
      titleHeight + headerHeight,
      Graphics.boxWidth - 300,
      contentHeight
    );
    this.addWindow(this._descWindow);

    this._detailsActive = false;
  };

  Scene_PersonalList.prototype.onItemOk = function () {
    const data = this._listWindow.item();
    this._headerWindow.setData(
      data.faceName,
      data.faceIndex,
      data.name,
      data.category,
      data.iconIndexes
    );
    this._descWindow.setText(data.notes);
    this._detailsActive = true;
    this._descWindow.activate();
  };

  Scene_PersonalList.prototype.update = function () {
    Scene_MenuBase.prototype.update.call(this);
    if (this._detailsActive && Input.isTriggered("cancel")) {
      this._detailsActive = false;
      this._headerWindow.clear();
      this._descWindow.clear();
      this._listWindow.activate();
    }
  };

  // ============================================================================
  //  Window_PersonalList Header
  // ============================================================================

  function Window_PersonalHeader(x, y, w, h) {
    Window_Base.call(this, x, y, w, h);
  }
  Window_PersonalHeader.prototype = Object.create(Window_Base.prototype);
  Window_PersonalHeader.prototype.constructor = Window_PersonalHeader;

  Window_PersonalHeader.prototype.setData = function (
    faceName,
    faceIndex,
    name,
    category,
    iconIndexes
  ) {
    this._faceName = faceName;
    this._faceIndex = faceIndex;
    this._npcName = name;
    this._npcCategory = category;
    this._iconIndexes = iconIndexes || [];
    this.refresh();
  };

  Window_PersonalHeader.prototype.clear = function () {
    this._faceName = "";
    this._npcName = "";
    this._npcCategory = "";
    this._iconIndexes = [];
    this.refresh();
  };

  Window_PersonalHeader.prototype.refresh = function () {
    this.contents.clear();
    const pad = this.textPadding();
    let x = pad;
    let y = 0;

    if (this._faceName) {
      this.drawFace(this._faceName, this._faceIndex, x, y);
      x += Window_Base._faceWidth + 12;
    }

    this.drawText(this._npcName || "", x, pad / 2, this.contentsWidth() - x);

    if (this._npcCategory) {
      y = pad / 2 + this.lineHeight();
      this.changeTextColor(this.systemColor());
      this.drawText(this._npcCategory, x, y, this.contentsWidth() - x);
      this.resetTextColor();
    }

    if (this._iconIndexes && this._iconIndexes.length) {
      const iconY = y + this.lineHeight() + 4;
      let iconX = x;
      this._iconIndexes.forEach((idx) => {
        this.drawIcon(idx, iconX, iconY);
        iconX += Window_Base._iconWidth + 4;
      });
    }
  };

  // ============================================================================
  // Foldable description
  // ============================================================================

  function Window_PersonalDesc(x, y, w, h) {
    Window_Base.call(this, x, y, w, h);
    this._pages = [];
    this._pageIdx = 0;
  }
  Window_PersonalDesc.prototype = Object.create(Window_Base.prototype);
  Window_PersonalDesc.prototype.constructor = Window_PersonalDesc;

  Window_PersonalDesc.prototype.setText = function (text) {
    const pad = this.textPadding();
    const maxW = this.contentsWidth() - pad * 2;
    const lh = this.lineHeight();
    const words = (text || "").split(" ");
    const lines = [""];
    let cur = "";
    for (const w of words) {
      const test = cur + w + " ";
      if (this.textWidth(test) > maxW && cur) {
        lines.push(w + " ");
        cur = w + " ";
      } else {
        cur = test;
        lines[lines.length - 1] = cur;
      }
    }
    const totalLines = lines.length;
    const linesPerPage = Math.max(
      1,
      Math.floor(this.contentsHeight() / lh) - 1
    );

    this._pages = [];
    for (let i = 0; i < totalLines; i += linesPerPage) {
      this._pages.push(lines.slice(i, i + linesPerPage));
    }
    this._pageIdx = 0;
    this.refresh();
  };

  Window_PersonalDesc.prototype.clear = function () {
    this._pages = [];
    this._pageIdx = 0;
    this.contents.clear();
  };

  Window_PersonalDesc.prototype.refresh = function () {
    this.contents.clear();
    const pad = this.textPadding();
    const lh = this.lineHeight();
    const maxHeight = this.contentsHeight() - lh;

    const page = this._pages[this._pageIdx] || [];
    for (let i = 0; i < page.length; i++) {
      const y = i * lh;
      if (y + lh > maxHeight) break;
      this.drawText(page[i], pad, y, this.contentsWidth() - pad * 2);
    }

    if (this._pages.length > 1) {
      const infoY = this.contentsHeight() - lh;
      this.changeTextColor(this.systemColor());
      this.drawText(
        `Lap: ${this._pageIdx + 1}/${this._pages.length} (◀ ▶)`,
        pad,
        infoY,
        this.contentsWidth() - pad * 2,
        "right"
      );
      this.resetTextColor();
    }
  };

  Window_PersonalDesc.prototype.update = function () {
    Window_Base.prototype.update.call(this);
    if (!this.active || this._pages.length < 2) return;
    if (Input.isTriggered("pageup") || Input.isTriggered("left")) {
      if (this._pageIdx > 0) {
        this._pageIdx--;
        this.refresh();
      }
    }
    if (Input.isTriggered("pagedown") || Input.isTriggered("right")) {
      if (this._pageIdx < this._pages.length - 1) {
        this._pageIdx++;
        this.refresh();
      }
    }
  };

  // ============================================================================
  // Window_PersonalList
  // ============================================================================
  function Window_PersonalList(x, y, w, h) {
    Window_Selectable.call(this, x, y, w, h);
    this.refresh();
    this.select(0);
    this.activate();
  }

  Window_PersonalList.prototype = Object.create(Window_Selectable.prototype);
  Window_PersonalList.prototype.constructor = Window_PersonalList;

  Window_PersonalList.prototype.maxItems = function () {
    return this._data ? this._data.length : 0;
  };

  Window_PersonalList.prototype.item = function () {
    return this._data && this.index() >= 0 ? this._data[this.index()] : null;
  };

  Window_PersonalList.prototype.refresh = function () {
    this._data = getPersonalList();
    this.createContents();
    this.drawAllItems();
  };

  Window_PersonalList.prototype.drawItem = function (index) {
    const item = this._data[index];
    if (item) {
      const rect = this.itemRectForText(index);
      this.drawText(item.name, rect.x, rect.y, rect.width);
    }
  };

  // ============================================================================
  // Window_PersonalDetails
  // ============================================================================
  function Window_PersonalDetails(x, y, w, h) {
    Window_Base.call(this, x, y, w, h);
    this._text = "";
    this._faceName = "";
    this._faceIndex = 0;
    this._npcName = "";
    this._npcCategory = "";
    this._scrollY = 0;
    this._textHeight = 0;
  }
  Window_PersonalDetails.prototype = Object.create(Window_Base.prototype);
  Window_PersonalDetails.prototype.constructor = Window_PersonalDetails;

  Window_PersonalDetails.prototype.setNpcData = function (
    faceName,
    faceIndex,
    text,
    name,
    category
  ) {
    this._faceName = faceName;
    this._faceIndex = faceIndex;
    this._text = text;
    this._npcName = name;
    this._npcCategory = category;
    this._scrollY = 0;
    this.refresh();
  };

  Window_PersonalDetails.prototype.refresh = function () {
    const pad = this.textPadding();
    const maxW = this.contentsWidth() - pad * 2;
    const lh = this.lineHeight();
    const words = this._text.split(" ");
    const lines = [""];
    let curLine = "";
    for (const w of words) {
      const test = curLine + w + " ";
      if (this.textWidth(test) > maxW && curLine) {
        lines.push(w + " ");
        curLine = w + " ";
      } else {
        curLine = test;
        lines[lines.length - 1] = curLine;
      }
    }
    const faceOff = this._faceName ? Window_Base._faceHeight + 10 : 0;
    this._textHeight = lines.length * lh + faceOff;

    const cw = this.contentsWidth();
    const ch = Math.max(this._textHeight, this.contentsHeight());
    this.contents = new Bitmap(cw, ch);
    this._windowContentsSprite.bitmap = this.contents;

    this.contents.clear();
    let y = 0;
    if (this._faceName) {
      this.drawFace(this._faceName, this._faceIndex, pad, y);
      const nameX = pad + Window_Base._faceWidth + 12;
      const nameY = y + lh / 2;
      this.drawText(this._npcName, nameX, nameY, cw - nameX);
      if (this._npcCategory) {
        this.changeTextColor(this.systemColor());
        this.drawText(this._npcCategory, nameX, nameY + lh, cw - nameX);
        this.resetTextColor();
      }
      y += faceOff;
    }
    for (let i = 0; i < lines.length; i++) {
      this.drawText(lines[i], pad, y + i * lh, maxW);
    }

    this._windowContentsSprite.y = pad - this._scrollY;
  };

  Window_PersonalDetails.prototype.update = function () {
    Window_Base.prototype.update.call(this);
    if (this.active && this._textHeight > this.contentsHeight()) {
      if (Input.isRepeated("down")) {
        this._scrollY = Math.min(
          this._scrollY + this.lineHeight(),
          this._textHeight - this.contentsHeight()
        );
        this._windowContentsSprite.y = this.textPadding() - this._scrollY;
      }
      if (Input.isRepeated("up")) {
        this._scrollY = Math.max(this._scrollY - this.lineHeight(), 0);
        this._windowContentsSprite.y = this.textPadding() - this._scrollY;
      }
    }
  };

  Window_PersonalDetails.prototype.drawTextAutoWrap = function (
    text,
    x,
    y,
    maxWidth,
    lineHeight
  ) {
    const words = text.split(" ");
    let line = "";
    let yy = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const testWidth = this.textWidth(testLine);
      if (testWidth > maxWidth && n > 0) {
        this.drawText(line, x, yy, maxWidth);
        line = words[n] + " ";
        yy += lineHeight;
      } else {
        line = testLine;
      }
    }
    this.drawText(line, x, yy, maxWidth);
  };

  // ====================================================================
  // BUTTON MONITORING FOR UPDATING FIELDKEP
  // ====================================================================
  const _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function () {
    _Scene_Map_update.call(this);
    if (Input.isTriggered(PERSONAL_KEY) && $gameSystem._personalMenuEnabled) {
      SceneManager.push(Scene_PersonalList);
    }
  };

  // ============================================================================
  // Initialisation
  // ============================================================================
  const _Scene_Boot_start = Scene_Boot.prototype.start;
  Scene_Boot.prototype.start = function () {
    _Scene_Boot_start.call(this);
    if ($gameSystem._personalMenuEnabled === undefined) {
      $gameSystem._personalMenuEnabled = enableInitial;
    }
  };

  // ============================================================================
  // Window_PersonalTitle
  // ============================================================================
  function Window_PersonalTitle() {
    const tempWin = new Window_Base(0, 0, 0, 0);
    const height = tempWin.fittingHeight(1);
    Window_Base.call(this, 0, 0, Graphics.boxWidth, height);
    this.refresh();
  }

  Window_PersonalTitle.prototype = Object.create(Window_Base.prototype);
  Window_PersonalTitle.prototype.constructor = Window_PersonalTitle;

  Window_PersonalTitle.prototype.refresh = function () {
    this.contents.clear();
    const text = PERSONAL_MENU_NAME;
    const y = (this.contentsHeight() - this.lineHeight()) / 2;
    this.drawText(text, 0, y, this.contentsWidth(), "center");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  Helper: query whether NPC is in the list
  // ─────────────────────────────────────────────────────────────────────────────
  Game_System.prototype.isPersonalAdded = function (id) {
    const list = this._personalList || [];
    return list.some((item) => item.id === String(id));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  API SYSTEM
  // ─────────────────────────────────────────────────────────────────────────────
  Game_System.prototype._personalListeners =
    Game_System.prototype._personalListeners || {};

  /**
   * Registers a callback when an NPC is added to the list.
   * @param {String|Number} id NPC id
   * @param {Function} callback function(id) – call, when added
   */
  Game_System.prototype.onPersonalAdded = function (id, callback) {
    id = String(id);
    const L = (this._personalListeners[id] = this._personalListeners[id] || {});
    L.added = L.added || [];
    L.added.push(callback);
  };

  /**
   * Registers a callback when an NPC is removed from the list.
   * @param {String|Number} id NPC id
   * @param {Function} callback function(id) – call when removed
   */
  Game_System.prototype.onPersonalRemoved = function (id, callback) {
    id = String(id);
    const L = (this._personalListeners[id] = this._personalListeners[id] || {});
    L.removed = L.removed || [];
    L.removed.push(callback);
  };

  Game_System.prototype._triggerPersonalAdded = function (id) {
    id = String(id);
    const L = this._personalListeners[id];
    if (L && L.added) L.added.forEach((cb) => cb(id));
  };
  Game_System.prototype._triggerPersonalRemoved = function (id) {
    id = String(id);
    const L = this._personalListeners[id];
    if (L && L.removed) L.removed.forEach((cb) => cb(id));
  };
})();
