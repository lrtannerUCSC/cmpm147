const fillers = {
  person: ["man", "woman", "citizen", "child", "grandma", "cat", "dog"],
  action: ["tripped", "fallen", "slipped", "been trapped", "been taken hostage", "been robbed"],
  place: ["the LEGO City River", "the LEGO City Bank", "a tree", "the LEGO City Donut Shop", "the LEGO City Pizza Palace"],
  action2: ["Build", "Create", "Use"],
  vehicle: ["helicopter", "police car", "garbage truck", "police boat", "tow truck"]
  
};

const template = `A $person has $action in $place!
HEY!
$action2 the $vehicle and off to the rescue!
The new emergency Collection from LEGO City!
`

// STUDENTS: You don't need to edit code below this line.

const slotPattern = /\$(\w+)/;

function replacer(match, name) {
  let options = fillers[name];
  if (options) {
    return options[Math.floor(Math.random() * options.length)];
  } else {
    return `<UNKNOWN:${name}>`;
  }
}

function generate() {
  let story = template;
  while (story.match(slotPattern)) {
    story = story.replace(slotPattern, replacer);
  }

  /* global box */
  box.innerText = story;
}

/* global clicker */
clicker.onclick = generate;

generate();
