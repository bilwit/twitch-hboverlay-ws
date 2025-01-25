import { PrismaClient } from "@prisma/client";
import consoleLogStyling from "../../../../utils/consoleLogStyling";
import { EventEmitter } from "stream";

interface Monster {
  id: number,
  hp_multiplier: number,
  hp_style: string,
  trigger_words: string,
  relations_id?: number | null,
}

interface Monster_Stages {
  hp_value: number,
  pause_init: boolean,
  trigger_words: string,
}

export interface Monster_CB {
  id: number,
  trigger_words: string,
  update: (amount: number, updatedMaxHealth: number) => void,
}

export default async function getMonsters(TwitchEmitter: EventEmitter, db: PrismaClient): Promise<Map<number, Monster_CB>
> {
  try {
    const monsters = await db.monster.findMany({
      select: {
        id: true,
        hp_multiplier: true,
        hp_style: true,
        trigger_words: true,
        relations_id: true,
      },
      where: {
        published: true,
      }
    });
  
    if (monsters && Array.isArray(monsters) && monsters.length > 0) {
      const monsterDict = new Map<number, Monster_CB>();

      for (const monster of monsters) {
        const stages = await db.stages.findMany({
          select: {
            hp_value: true,
            pause_init: true,
            trigger_words: true,
          },
          where: {
            ref_id: monster.id,
          }
        });

        monsterDict.set(monster.id, Monster(monster, TwitchEmitter, stages));
      }

      return monsterDict;
    } else {
      return new Map<number, Monster_CB>();
    }
  } catch (e) {
    console.error(e);
    return new Map<number, Monster_CB>();
  }
}

export async function getMonster(id: number, TwitchEmitter: EventEmitter, db: PrismaClient): Promise<Monster_CB | null> {
  try {
    const monster = await db.monster.findFirst({
      select: {
        id: true,
        hp_multiplier: true,
        hp_style: true,
        trigger_words: true,
        relations_id: true,
      },
      where: {
        id: id,
      }
    });

    const stages = await db.stages.findMany({
      select: {
        hp_value: true,
        pause_init: true,
        trigger_words: true,
      },
      where: {
        ref_id: id,
      }
    });

    if (monster) {
      return Monster(monster, TwitchEmitter, stages);
    } else {
      throw 'Monster ID not found';
    }
  } catch (e) {
    console.error(e);
    return null;
  }
}

function Monster(monster: Monster, TwitchEmitter: EventEmitter, stages: Monster_Stages[]): any {
  try {
    let isPaused = false;
    let isDead = false;

    let CurrentHealth = {
      maxHealth: maxHealth(),
      value: currentHealth(),
    };

    // keep a dictionary of thresholds met for hp stages
    const thresholdPassed = new Map();

    // initialize health
    function maxHealth () {
      switch (monster.hp_style) {
        default:
        case 'Fixed':
        case 'Growing':
        case 'Scaled':
          return monster.hp_multiplier;
      }
    }
    function currentHealth() {
      switch (monster.hp_style) {
        case 'Growing':
          return 0;
        default:
        case 'Fixed':
        case 'Scaled':
          return monster.hp_multiplier;
      }
    }

    function updateHealth() {
      TwitchEmitter.emit('update', {
        channels: [monster.id],
        id: monster.id,
        value: {
          ...CurrentHealth,
          isPaused: isPaused,
          isDead: isDead,
        },
      });
    }

    TwitchEmitter.on('pause', (data) => {
      if (
        (monster.id === data?.id) || 
        (monster.relations_id && data?.relations_id === monster.relations_id)
      ) {
        isPaused = true;
        updateHealth();
        console.log(consoleLogStyling('health', '(' + monster.id + ') Paused'));
      }
    });

    TwitchEmitter.on('unpause', (data) => {
      if (
        (monster.id === data?.id) || 
        (monster.relations_id && data?.relations_id === monster.relations_id)
      ) {
        isPaused = false;
        updateHealth();
        console.log(consoleLogStyling('health', '(' + monster.id + ') Unpaused'));
      }
    });

    TwitchEmitter.on('reset', (data) => {
      if (
        (data?.id && data.id === monster.id) || 
        (data?.relations_id && data.relations_id === monster.relations_id)
      ) {
        switch (monster.hp_style) {
          case 'Growing':
            CurrentHealth.value = 0;
            break;
          default:
          case 'Fixed':
          case 'Scaled':
            CurrentHealth.value = CurrentHealth.maxHealth;
            break;
        }
        isDead = false;
        updateHealth();
        thresholdPassed.clear();
        console.log(consoleLogStyling('health', '(' + monster.id + ') Health Reset: ' + CurrentHealth.value));
      }
    });

    TwitchEmitter.on('current', (data) => {
      if (Number(data.id) === Number(monster.id)) {
        updateHealth();
      }
    });

    // send initial health data
    updateHealth();
    console.log(consoleLogStyling('health', '(' + monster.id + ') Initial Health: ' + CurrentHealth.value));

    return {
      id: monster.id,
      trigger_words: monster.trigger_words,
      thresholdPassed: thresholdPassed,
      update: function(amount: number, updatedChatterAmount: number) {
        switch (monster.hp_style) {
          case 'Growing':
            if (!isDead && !isPaused) {
              if ((monster.hp_multiplier === 0) || (monster.hp_multiplier > 0 && CurrentHealth.value < monster.hp_multiplier)) {
                CurrentHealth.value -= amount;
              } else {
                if (CurrentHealth.value >= monster.hp_multiplier) {
                  isDead = true;
                  TwitchEmitter.emit('pause', {
                    id: monster.id,
                    relations_id: monster.relations_id,
                  });
                }

                if (stages && stages.length > 0) {
                  for (const stage of stages) {
                    if (!thresholdPassed.has(stage.hp_value) && CurrentHealth.value >= stage.hp_value) {
                      thresholdPassed.set(stage.hp_value, stage?.trigger_words || '');

                      if (stage.pause_init) {
                        TwitchEmitter.emit('pause', {
                          id: monster.id,
                          relations_id: monster.relations_id,
                        });
                      }
                    }
                  }
                }
              }
            }
            break;

          default:
          case 'Fixed':
          case 'Scaled':
            if (CurrentHealth.value >= 0) {
              if (!isDead && !isPaused) {
                if (monster.hp_style === 'Fixed') {
                  CurrentHealth.value = Math.max(0, CurrentHealth.value + amount);

                  if (stages && stages.length > 0) {
                    for (const stage of stages) {
                      if (!thresholdPassed.has(stage.hp_value) && CurrentHealth.value <= stage.hp_value) {
                        thresholdPassed.set(stage.hp_value, stage?.trigger_words || '');

                        if (stage.pause_init) {
                          TwitchEmitter.emit('pause', {
                            id: monster.id,
                            relations_id: monster.relations_id,
                          });
                        }
                      }
                    }
                  }
                }
    
                if (monster.hp_style === 'Scaled') {
                  const updatedMaxHealth = updatedChatterAmount * monster.hp_multiplier;
    
                  if (CurrentHealth.maxHealth !== updatedMaxHealth) {              
                    CurrentHealth.value = Math.max(0, (CurrentHealth.value / CurrentHealth.maxHealth) * updatedMaxHealth + amount);
                    CurrentHealth.maxHealth = updatedMaxHealth;
                  } else {
                    CurrentHealth.value += amount;
                  }

                  if (stages && stages.length > 0) {
                    for (const stage of stages) {
                      const scaledThreshold = updatedMaxHealth * (stage.hp_value / 100);

                      if (!thresholdPassed.has(stage.hp_value) && CurrentHealth.value <= scaledThreshold) {
                        thresholdPassed.set(stage.hp_value, stage?.trigger_words || '');

                        if (stage.pause_init) {
                          TwitchEmitter.emit('pause', {
                            id: monster.id,
                            relations_id: monster.relations_id,
                          });
                        }
                      }
                    }
                  }
                }

                if (CurrentHealth.value <= 0) {
                  isDead = true;
                  TwitchEmitter.emit('pause', {
                    id: monster.id,
                    relations_id: monster.relations_id,
                  });
                }
              }
            }
            break;
        }

        updateHealth();
        console.log(consoleLogStyling('health', '(' + monster.id + ') Current Health: ' + CurrentHealth.value));
      }
    }

  } catch (e) {
    console.log(e);
  }
}

