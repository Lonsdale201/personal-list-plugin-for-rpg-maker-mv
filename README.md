# Personals Plugin for RPG Maker MV

**Author:** Kristof Soczó

**Version:** 1.2

## Description

With this plugin, you can track and list NPCs that the player meets during gameplay. Only NPCs you explicitly add via plugin commands will appear in the list. You can remove entries at any time or update their data.

In the menu, NPC names appear on the left. Selecting a name opens a detail window showing a face graphic, name, category, up to 3 icons, and a potentially long description.

## Installation

1. Place `Personallist.js` in your project's `js/plugins/` folder.
2. In RPG Maker MV's Plugin Manager, enable **Personallist** and configure the parameters.

## Parameters

* **Menu Title**: Text shown in the menu list (default: `Personals`).
* **Enable Initially**: Whether the menu is available at game start.
* **Open Menu Key**: Keyboard key that opens the Personals menu directly (e.g. `pageup`, `q`).

## Plugin Commands

Use these commands in an event's **Plugin Command** box:

| Command                       | Effect                                                 |
| ----------------------------- | ------------------------------------------------------ |
| `EnablePersonalMenu`          | Enables the Personals menu immediately.                |
| `DisablePersonalMenu`         | Disables the menu so it no longer appears.             |
| `AddPersonalToList`           | Adds the NPC defined in the current event's comments.  |
| `AddPersonalToList <id>`      | Finds NPC by ID across all events and adds/updates it. |
| `RemovePersonalFromList <id>` | Removes the NPC with the given ID from the list.       |

## Script Calls

* **Check if NPC is in list**:

  ```js
  if ($gameSystem.isPersonalAdded(5)) {  
    // NPC 5 is in the list  
  }  
  ```

* **Register callbacks**:

  ```js
  // When NPC 3 is added:  
  $gameSystem.onPersonalAdded(3, id => {  
    console.log(`NPC ${id} added`);  
  });  

  // When removed:  
  $gameSystem.onPersonalRemoved(3, id => {  
    console.log(`NPC ${id} removed`);  
  });  
  ```

## Defining NPCs in Event Comments

To make an event’s NPC collectible, include comment lines on that event page. You may split into multiple comment blocks if needed — each block must start with `Type: NPC` and `ID: <same ID>`.

Example block:

```
Type: NPC
ID: 1
Name: John, the Innkeeper
Category: Bartender
Face: Actor1, 3
Icon: 1,2,3    (max 3 icons)
Details: John has served travelers for years,
         and always has a story to tell.
```

* **Type** and **ID** lines are required in each block.
* Other lines (Name, Category, Face, Icon, Details) can appear in any order.

<img width="1036" height="761" alt="image" src="https://github.com/user-attachments/assets/f9167ad6-cd52-42b2-b8eb-a1a2245c9c1a" />


## Developer API

This plugin exposes a simple API on Game_System to let other plugins or game code react when NPCs are added to or removed from the list.

**Event Hooks**

`$gameSystem.onPersonalAdded(id, callback)` Register a callback that will be invoked when the NPC with the given id is added to the list.

`$gameSystem.onPersonalRemoved(id, callback)` Register a callback that will be invoked when the NPC with the given id is removed from the list.

Both hooks accept either a String or Number for the id, and a Function(id) callback that receives the NPC id as its argument.

**Query Methods**

`$gameSystem.isPersonalAdded(id)` Returns true if the NPC with the specified id is currently in the player’s personal list, otherwise false.

## Changelog

**v1.2** 
2025.07.18

• Added bulk operations: you can now call
• AddPersonalToList <id1> <id2> <id3> …
• RemovePersonalFromList <id1> <id2> …
to add or remove multiple NPCs in one command.
• RemovePersonalFromList with no arguments will now remove all NPCs defined
in the current event page, even if no ID is supplied.
