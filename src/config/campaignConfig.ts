/**
 * 战役配置 - 神秘探索主题
 * 包含7个章节，共35个任务
 */

import { BuildingType, TechnologyType, ShipType, ObjectiveType } from '@/types/game'
import type { CampaignConfig, CampaignChapterConfig, CampaignQuestConfig } from '@/types/game'

// ==================== 第一章：起源之地 ====================
const chapter1Quests: CampaignQuestConfig[] = [
  {
    id: 'quest_1_1',
    chapter: 1,
    order: 1,
    titleKey: 'campaign.quests.1_1.title',
    descriptionKey: 'campaign.quests.1_1.description',
    prologueDialogues: [
      {
        id: 'quest_1_1_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.1_1.prologue_1'
      },
      {
        id: 'quest_1_1_prologue_2',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientVoice',
        textKey: 'campaign.dialogues.1_1.prologue_2'
      }
    ],
    objectives: [
      {
        id: 'obj_1_1_1',
        type: ObjectiveType.BuildBuilding,
        descriptionKey: 'campaign.objectiveDescriptions.buildMetalMine',
        target: BuildingType.MetalMine,
        targetSecondary: 2,
        required: 1
      },
      {
        id: 'obj_1_1_2',
        type: ObjectiveType.BuildBuilding,
        descriptionKey: 'campaign.objectiveDescriptions.buildCrystalMine',
        target: BuildingType.CrystalMine,
        targetSecondary: 2,
        required: 1
      },
      {
        id: 'obj_1_1_3',
        type: ObjectiveType.BuildBuilding,
        descriptionKey: 'campaign.objectiveDescriptions.buildSolarPlant',
        target: BuildingType.SolarPlant,
        targetSecondary: 2,
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 5000, crystal: 2500, deuterium: 0 },
      darkMatter: 50,
      points: 100
    },
    mapPosition: { x: 50, y: 20 }
  },
  {
    id: 'quest_1_2',
    chapter: 1,
    order: 2,
    titleKey: 'campaign.quests.1_2.title',
    descriptionKey: 'campaign.quests.1_2.description',
    requiredQuestIds: ['quest_1_1'],
    prologueDialogues: [
      {
        id: 'quest_1_2_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.1_2.prologue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_1_2_1',
        type: ObjectiveType.BuildBuilding,
        descriptionKey: 'campaign.objectiveDescriptions.buildResearchLab',
        target: BuildingType.ResearchLab,
        targetSecondary: 1,
        required: 1
      },
      {
        id: 'obj_1_2_2',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchEnergy',
        target: TechnologyType.EnergyTechnology,
        targetSecondary: 1,
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 3000, crystal: 3000, deuterium: 1000 },
      darkMatter: 75,
      points: 150
    },
    mapPosition: { x: 50, y: 35 }
  },
  {
    id: 'quest_1_3',
    chapter: 1,
    order: 3,
    titleKey: 'campaign.quests.1_3.title',
    descriptionKey: 'campaign.quests.1_3.description',
    requiredQuestIds: ['quest_1_2'],
    prologueDialogues: [
      {
        id: 'quest_1_3_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.1_3.prologue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_1_3_1',
        type: ObjectiveType.BuildBuilding,
        descriptionKey: 'campaign.objectiveDescriptions.buildShipyard',
        target: BuildingType.Shipyard,
        targetSecondary: 2,
        required: 1
      },
      {
        id: 'obj_1_3_2',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchCombustion',
        target: TechnologyType.CombustionDrive,
        targetSecondary: 1,
        required: 1
      },
      {
        id: 'obj_1_3_3',
        type: ObjectiveType.ProduceShips,
        descriptionKey: 'campaign.objectiveDescriptions.buildLightFighters',
        target: ShipType.LightFighter,
        required: 5
      }
    ],
    rewards: {
      resources: { metal: 5000, crystal: 2000, deuterium: 500 },
      ships: { [ShipType.SmallCargo]: 2 },
      darkMatter: 100,
      points: 200
    },
    mapPosition: { x: 50, y: 50 }
  },
  {
    id: 'quest_1_4',
    chapter: 1,
    order: 4,
    titleKey: 'campaign.quests.1_4.title',
    descriptionKey: 'campaign.quests.1_4.description',
    requiredQuestIds: ['quest_1_3'],
    prologueDialogues: [
      {
        id: 'quest_1_4_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.1_4.prologue_1'
      },
      {
        id: 'quest_1_4_prologue_2',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientVoice',
        textKey: 'campaign.dialogues.1_4.prologue_2'
      }
    ],
    objectives: [
      {
        id: 'obj_1_4_1',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchEspionage',
        target: TechnologyType.EspionageTechnology,
        targetSecondary: 1,
        required: 1
      },
      {
        id: 'obj_1_4_2',
        type: ObjectiveType.ProduceShips,
        descriptionKey: 'campaign.objectiveDescriptions.buildSpyProbes',
        target: ShipType.EspionageProbe,
        required: 3
      },
      {
        id: 'obj_1_4_3',
        type: ObjectiveType.SpyTarget,
        descriptionKey: 'campaign.objectiveDescriptions.spyAnyNPC',
        target: 'any',
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 4000, crystal: 4000, deuterium: 1000 },
      darkMatter: 150,
      points: 250
    },
    mapPosition: { x: 50, y: 65 }
  },
  {
    id: 'quest_1_5',
    chapter: 1,
    order: 5,
    titleKey: 'campaign.quests.1_5.title',
    descriptionKey: 'campaign.quests.1_5.description',
    requiredQuestIds: ['quest_1_4'],
    prologueDialogues: [
      {
        id: 'quest_1_5_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.1_5.prologue_1'
      }
    ],
    epilogueDialogues: [
      {
        id: 'quest_1_5_epilogue_1',
        speaker: 'npc',
        speakerNameKey: 'campaign.speakers.neighborNPC',
        textKey: 'campaign.dialogues.1_5.epilogue_1'
      },
      {
        id: 'quest_1_5_epilogue_2',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientVoice',
        textKey: 'campaign.dialogues.1_5.epilogue_2'
      }
    ],
    objectives: [
      {
        id: 'obj_1_5_1',
        type: ObjectiveType.SendGift,
        descriptionKey: 'campaign.objectiveDescriptions.sendGiftToNPC',
        target: 'any',
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 10000, crystal: 5000, deuterium: 2000 },
      darkMatter: 200,
      points: 500
    },
    mapPosition: { x: 50, y: 80 }
  }
]

// ==================== 第二章：星际探索 ====================
const chapter2Quests: CampaignQuestConfig[] = [
  {
    id: 'quest_2_1',
    chapter: 2,
    order: 1,
    titleKey: 'campaign.quests.2_1.title',
    descriptionKey: 'campaign.quests.2_1.description',
    requiredQuestIds: ['quest_1_5'],
    prologueDialogues: [
      {
        id: 'quest_2_1_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.2_1.prologue_1'
      },
      {
        id: 'quest_2_1_prologue_2',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientVoice',
        textKey: 'campaign.dialogues.2_1.prologue_2'
      }
    ],
    objectives: [
      {
        id: 'obj_2_1_1',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchAstrophysics',
        target: TechnologyType.Astrophysics,
        targetSecondary: 1,
        required: 1
      },
      {
        id: 'obj_2_1_2',
        type: ObjectiveType.ProduceShips,
        descriptionKey: 'campaign.objectiveDescriptions.buildColonyShip',
        target: ShipType.ColonyShip,
        required: 1
      },
      {
        id: 'obj_2_1_3',
        type: ObjectiveType.Colonize,
        descriptionKey: 'campaign.objectiveDescriptions.colonizeNewPlanet',
        target: 'any',
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 15000, crystal: 10000, deuterium: 5000 },
      darkMatter: 300,
      points: 600
    },
    mapPosition: { x: 30, y: 20 }
  },
  {
    id: 'quest_2_2',
    chapter: 2,
    order: 2,
    titleKey: 'campaign.quests.2_2.title',
    descriptionKey: 'campaign.quests.2_2.description',
    requiredQuestIds: ['quest_2_1'],
    prologueDialogues: [
      {
        id: 'quest_2_2_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.2_2.prologue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_2_2_1',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchAstrophysicsHigher',
        target: TechnologyType.Astrophysics,
        targetSecondary: 3,
        required: 1
      },
      {
        id: 'obj_2_2_2',
        type: ObjectiveType.Expedition,
        descriptionKey: 'campaign.objectiveDescriptions.completeExpedition',
        target: 'any',
        required: 3
      }
    ],
    rewards: {
      resources: { metal: 20000, crystal: 15000, deuterium: 8000 },
      darkMatter: 500,
      points: 800
    },
    mapPosition: { x: 30, y: 35 }
  },
  {
    id: 'quest_2_3',
    chapter: 2,
    order: 3,
    titleKey: 'campaign.quests.2_3.title',
    descriptionKey: 'campaign.quests.2_3.description',
    requiredQuestIds: ['quest_2_2'],
    prologueDialogues: [
      {
        id: 'quest_2_3_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.2_3.prologue_1'
      },
      {
        id: 'quest_2_3_prologue_2',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientVoice',
        textKey: 'campaign.dialogues.2_3.prologue_2'
      }
    ],
    objectives: [
      {
        id: 'obj_2_3_1',
        type: ObjectiveType.Expedition,
        descriptionKey: 'campaign.objectiveDescriptions.expeditionDeepSpace',
        target: 'deepSpace',
        required: 2
      }
    ],
    rewards: {
      resources: { metal: 25000, crystal: 20000, deuterium: 10000 },
      darkMatter: 750,
      points: 1000
    },
    mapPosition: { x: 30, y: 50 }
  },
  {
    id: 'quest_2_4',
    chapter: 2,
    order: 4,
    titleKey: 'campaign.quests.2_4.title',
    descriptionKey: 'campaign.quests.2_4.description',
    requiredQuestIds: ['quest_2_3'],
    prologueDialogues: [
      {
        id: 'quest_2_4_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.2_4.prologue_1'
      },
      {
        id: 'quest_2_4_prologue_2',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientVoice',
        textKey: 'campaign.dialogues.2_4.prologue_2',
        choices: [
          {
            textKey: 'campaign.dialogues.2_4.choice_1',
            effect: 'reputation_up'
          },
          {
            textKey: 'campaign.dialogues.2_4.choice_2',
            effect: 'unlock_branch'
          }
        ]
      }
    ],
    objectives: [
      {
        id: 'obj_2_4_1',
        type: ObjectiveType.Expedition,
        descriptionKey: 'campaign.objectiveDescriptions.expeditionUncharted',
        target: 'unchartedSpace',
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 30000, crystal: 25000, deuterium: 15000 },
      darkMatter: 1000,
      points: 1500
    },
    mapPosition: { x: 30, y: 65 }
  },
  {
    id: 'quest_2_5',
    chapter: 2,
    order: 5,
    titleKey: 'campaign.quests.2_5.title',
    descriptionKey: 'campaign.quests.2_5.description',
    requiredQuestIds: ['quest_2_4'],
    prologueDialogues: [
      {
        id: 'quest_2_5_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.2_5.prologue_1'
      }
    ],
    epilogueDialogues: [
      {
        id: 'quest_2_5_epilogue_1',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientVoice',
        textKey: 'campaign.dialogues.2_5.epilogue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_2_5_1',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchImpulse',
        target: TechnologyType.ImpulseDrive,
        targetSecondary: 3,
        required: 1
      },
      {
        id: 'obj_2_5_2',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchLaser',
        target: TechnologyType.LaserTechnology,
        targetSecondary: 5,
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 40000, crystal: 30000, deuterium: 20000 },
      darkMatter: 1500,
      points: 2000
    },
    mapPosition: { x: 30, y: 80 }
  }
]

// ==================== 第三章：银河外交 ====================
const chapter3Quests: CampaignQuestConfig[] = [
  {
    id: 'quest_3_1',
    chapter: 3,
    order: 1,
    titleKey: 'campaign.quests.3_1.title',
    descriptionKey: 'campaign.quests.3_1.description',
    requiredQuestIds: ['quest_2_5'],
    prologueDialogues: [
      {
        id: 'quest_3_1_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.3_1.prologue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_3_1_1',
        type: ObjectiveType.SendGift,
        descriptionKey: 'campaign.objectiveDescriptions.sendMultipleGifts',
        target: 'any',
        required: 3
      }
    ],
    rewards: {
      resources: { metal: 25000, crystal: 20000, deuterium: 10000 },
      darkMatter: 500,
      points: 1000
    },
    mapPosition: { x: 70, y: 20 }
  },
  {
    id: 'quest_3_2',
    chapter: 3,
    order: 2,
    titleKey: 'campaign.quests.3_2.title',
    descriptionKey: 'campaign.quests.3_2.description',
    requiredQuestIds: ['quest_3_1'],
    prologueDialogues: [
      {
        id: 'quest_3_2_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.3_2.prologue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_3_2_1',
        type: ObjectiveType.ReachRelation,
        descriptionKey: 'campaign.objectiveDescriptions.reachFriendlyRelation',
        target: 'friendly',
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 30000, crystal: 25000, deuterium: 15000 },
      darkMatter: 750,
      points: 1200
    },
    mapPosition: { x: 70, y: 35 }
  },
  {
    id: 'quest_3_3',
    chapter: 3,
    order: 3,
    titleKey: 'campaign.quests.3_3.title',
    descriptionKey: 'campaign.quests.3_3.description',
    requiredQuestIds: ['quest_3_2'],
    prologueDialogues: [
      {
        id: 'quest_3_3_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.3_3.prologue_1'
      },
      {
        id: 'quest_3_3_prologue_2',
        speaker: 'npc',
        speakerNameKey: 'campaign.speakers.allyNPC',
        textKey: 'campaign.dialogues.3_3.prologue_2'
      }
    ],
    objectives: [
      {
        id: 'obj_3_3_1',
        type: ObjectiveType.SpyTarget,
        descriptionKey: 'campaign.objectiveDescriptions.spyHostileNPC',
        target: 'hostile',
        required: 2
      }
    ],
    rewards: {
      resources: { metal: 35000, crystal: 30000, deuterium: 18000 },
      darkMatter: 1000,
      points: 1500
    },
    mapPosition: { x: 70, y: 50 }
  },
  {
    id: 'quest_3_4',
    chapter: 3,
    order: 4,
    titleKey: 'campaign.quests.3_4.title',
    descriptionKey: 'campaign.quests.3_4.description',
    guideKey: 'campaign.quests.3_4.guide',
    requiredQuestIds: ['quest_3_3'],
    prologueDialogues: [
      {
        id: 'quest_3_4_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.3_4.prologue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_3_4_1',
        type: ObjectiveType.FormAlliance,
        descriptionKey: 'campaign.objectiveDescriptions.formAlliance',
        target: 'any',
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 40000, crystal: 35000, deuterium: 20000 },
      darkMatter: 1250,
      points: 1800
    },
    mapPosition: { x: 70, y: 65 }
  },
  {
    id: 'quest_3_5',
    chapter: 3,
    order: 5,
    titleKey: 'campaign.quests.3_5.title',
    descriptionKey: 'campaign.quests.3_5.description',
    requiredQuestIds: ['quest_3_4'],
    prologueDialogues: [
      {
        id: 'quest_3_5_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.3_5.prologue_1'
      }
    ],
    epilogueDialogues: [
      {
        id: 'quest_3_5_epilogue_1',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientVoice',
        textKey: 'campaign.dialogues.3_5.epilogue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_3_5_1',
        type: ObjectiveType.BuildBuilding,
        descriptionKey: 'campaign.objectiveDescriptions.buildMissileSilo',
        target: BuildingType.MissileSilo,
        targetSecondary: 2,
        required: 1
      },
      {
        id: 'obj_3_5_2',
        type: ObjectiveType.ProduceShips,
        descriptionKey: 'campaign.objectiveDescriptions.buildCruisers',
        target: ShipType.Cruiser,
        required: 10
      }
    ],
    rewards: {
      resources: { metal: 50000, crystal: 40000, deuterium: 25000 },
      darkMatter: 2000,
      points: 2500
    },
    mapPosition: { x: 70, y: 80 }
  }
]

// ==================== 第四章：暗影降临 ====================
const chapter4Quests: CampaignQuestConfig[] = [
  {
    id: 'quest_4_1',
    chapter: 4,
    order: 1,
    titleKey: 'campaign.quests.4_1.title',
    descriptionKey: 'campaign.quests.4_1.description',
    requiredQuestIds: ['quest_3_5'],
    prologueDialogues: [
      {
        id: 'quest_4_1_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.4_1.prologue_1'
      },
      {
        id: 'quest_4_1_prologue_2',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.shadowVoice',
        textKey: 'campaign.dialogues.4_1.prologue_2'
      }
    ],
    objectives: [
      {
        id: 'obj_4_1_1',
        type: ObjectiveType.WinBattles,
        descriptionKey: 'campaign.objectiveDescriptions.defendAgainstAttack',
        target: 'defense',
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 40000, crystal: 35000, deuterium: 20000 },
      darkMatter: 1000,
      points: 1500
    },
    mapPosition: { x: 50, y: 20 }
  },
  {
    id: 'quest_4_2',
    chapter: 4,
    order: 2,
    titleKey: 'campaign.quests.4_2.title',
    descriptionKey: 'campaign.quests.4_2.description',
    requiredQuestIds: ['quest_4_1'],
    prologueDialogues: [
      {
        id: 'quest_4_2_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.4_2.prologue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_4_2_1',
        type: ObjectiveType.SpyTarget,
        descriptionKey: 'campaign.objectiveDescriptions.spyEnemyPlanets',
        target: 'hostile',
        required: 5
      }
    ],
    rewards: {
      resources: { metal: 45000, crystal: 40000, deuterium: 25000 },
      darkMatter: 1250,
      points: 1800
    },
    mapPosition: { x: 50, y: 35 }
  },
  {
    id: 'quest_4_3',
    chapter: 4,
    order: 3,
    titleKey: 'campaign.quests.4_3.title',
    descriptionKey: 'campaign.quests.4_3.description',
    requiredQuestIds: ['quest_4_2'],
    prologueDialogues: [
      {
        id: 'quest_4_3_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.4_3.prologue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_4_3_1',
        type: ObjectiveType.WinBattles,
        descriptionKey: 'campaign.objectiveDescriptions.winAttackBattles',
        target: 'attack',
        required: 3
      }
    ],
    rewards: {
      resources: { metal: 50000, crystal: 45000, deuterium: 30000 },
      darkMatter: 1500,
      points: 2000
    },
    mapPosition: { x: 50, y: 50 }
  },
  {
    id: 'quest_4_4',
    chapter: 4,
    order: 4,
    titleKey: 'campaign.quests.4_4.title',
    descriptionKey: 'campaign.quests.4_4.description',
    requiredQuestIds: ['quest_4_3'],
    prologueDialogues: [
      {
        id: 'quest_4_4_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.4_4.prologue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_4_4_1',
        type: ObjectiveType.RecycleDebris,
        descriptionKey: 'campaign.objectiveDescriptions.recycleDebris',
        target: 'any',
        required: 5
      }
    ],
    rewards: {
      resources: { metal: 55000, crystal: 50000, deuterium: 35000 },
      darkMatter: 1750,
      points: 2200
    },
    mapPosition: { x: 50, y: 65 }
  },
  {
    id: 'quest_4_5',
    chapter: 4,
    order: 5,
    titleKey: 'campaign.quests.4_5.title',
    descriptionKey: 'campaign.quests.4_5.description',
    requiredQuestIds: ['quest_4_4'],
    prologueDialogues: [
      {
        id: 'quest_4_5_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.4_5.prologue_1'
      }
    ],
    epilogueDialogues: [
      {
        id: 'quest_4_5_epilogue_1',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientVoice',
        textKey: 'campaign.dialogues.4_5.epilogue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_4_5_1',
        type: ObjectiveType.ProduceShips,
        descriptionKey: 'campaign.objectiveDescriptions.buildBattleships',
        target: ShipType.Battleship,
        required: 20
      },
      {
        id: 'obj_4_5_2',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchHyperspace',
        target: TechnologyType.HyperspaceDrive,
        targetSecondary: 3,
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 70000, crystal: 60000, deuterium: 40000 },
      darkMatter: 2500,
      points: 3000
    },
    mapPosition: { x: 50, y: 80 }
  }
]

// ==================== 第五章：古代秘密 ====================
const chapter5Quests: CampaignQuestConfig[] = [
  {
    id: 'quest_5_1',
    chapter: 5,
    order: 1,
    titleKey: 'campaign.quests.5_1.title',
    descriptionKey: 'campaign.quests.5_1.description',
    requiredQuestIds: ['quest_4_5'],
    prologueDialogues: [
      {
        id: 'quest_5_1_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.5_1.prologue_1'
      },
      {
        id: 'quest_5_1_prologue_2',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientVoice',
        textKey: 'campaign.dialogues.5_1.prologue_2'
      }
    ],
    objectives: [
      {
        id: 'obj_5_1_1',
        type: ObjectiveType.Expedition,
        descriptionKey: 'campaign.objectiveDescriptions.expeditionDangerous',
        target: 'dangerousNebula',
        required: 3
      }
    ],
    rewards: {
      resources: { metal: 80000, crystal: 70000, deuterium: 50000 },
      darkMatter: 3000,
      points: 4000
    },
    mapPosition: { x: 50, y: 15 }
  },
  {
    id: 'quest_5_2',
    chapter: 5,
    order: 2,
    titleKey: 'campaign.quests.5_2.title',
    descriptionKey: 'campaign.quests.5_2.description',
    requiredQuestIds: ['quest_5_1'],
    prologueDialogues: [
      {
        id: 'quest_5_2_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.5_2.prologue_1'
      },
      {
        id: 'quest_5_2_prologue_2',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientGuardian',
        textKey: 'campaign.dialogues.5_2.prologue_2'
      }
    ],
    objectives: [
      {
        id: 'obj_5_2_1',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchIntergalactic',
        target: TechnologyType.ComputerTechnology,
        targetSecondary: 10,
        required: 1
      },
      {
        id: 'obj_5_2_2',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchGraviton',
        target: TechnologyType.GravitonTechnology,
        targetSecondary: 1,
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 100000, crystal: 80000, deuterium: 60000 },
      darkMatter: 5000,
      points: 5000
    },
    mapPosition: { x: 50, y: 32 }
  },
  {
    id: 'quest_5_3',
    chapter: 5,
    order: 3,
    titleKey: 'campaign.quests.5_3.title',
    descriptionKey: 'campaign.quests.5_3.description',
    requiredQuestIds: ['quest_5_2'],
    isBoss: true,
    prologueDialogues: [
      {
        id: 'quest_5_3_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.5_3.prologue_1'
      },
      {
        id: 'quest_5_3_prologue_2',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientGuardian',
        textKey: 'campaign.dialogues.5_3.prologue_2'
      }
    ],
    epilogueDialogues: [
      {
        id: 'quest_5_3_epilogue_1',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientGuardian',
        textKey: 'campaign.dialogues.5_3.epilogue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_5_3_1',
        type: ObjectiveType.DefeatNPC,
        descriptionKey: 'campaign.objectiveDescriptions.defeatBoss',
        target: 'boss',
        required: 1
      }
    ],
    rewards: {
      resources: { metal: 150000, crystal: 120000, deuterium: 80000 },
      ships: { [ShipType.Deathstar]: 1 },
      darkMatter: 10000,
      points: 10000
    },
    mapPosition: { x: 50, y: 50 }
  },
  {
    id: 'quest_5_4',
    chapter: 5,
    order: 4,
    titleKey: 'campaign.quests.5_4.title',
    descriptionKey: 'campaign.quests.5_4.description',
    requiredQuestIds: ['quest_5_3'],
    prologueDialogues: [
      {
        id: 'quest_5_4_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.5_4.prologue_1'
      }
    ],
    objectives: [
      {
        id: 'obj_5_4_1',
        type: ObjectiveType.Colonize,
        descriptionKey: 'campaign.objectiveDescriptions.colonizeMultiple',
        target: 'any',
        required: 5
      }
    ],
    rewards: {
      resources: { metal: 200000, crystal: 150000, deuterium: 100000 },
      darkMatter: 8000,
      points: 8000
    },
    mapPosition: { x: 50, y: 68 }
  },
  {
    id: 'quest_5_5',
    chapter: 5,
    order: 5,
    titleKey: 'campaign.quests.5_5.title',
    descriptionKey: 'campaign.quests.5_5.description',
    requiredQuestIds: ['quest_5_4'],
    prologueDialogues: [
      {
        id: 'quest_5_5_prologue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.5_5.prologue_1'
      }
    ],
    epilogueDialogues: [
      {
        id: 'quest_5_5_epilogue_1',
        speaker: 'narrator',
        textKey: 'campaign.dialogues.5_5.epilogue_1'
      },
      {
        id: 'quest_5_5_epilogue_2',
        speaker: 'mysterious',
        speakerNameKey: 'campaign.speakers.ancientVoice',
        textKey: 'campaign.dialogues.5_5.epilogue_2'
      }
    ],
    objectives: [
      {
        id: 'obj_5_5_1',
        type: ObjectiveType.AccumulateResources,
        descriptionKey: 'campaign.objectiveDescriptions.accumulateWealth',
        target: 'total',
        required: 1000000
      }
    ],
    rewards: {
      resources: { metal: 500000, crystal: 400000, deuterium: 250000 },
      darkMatter: 20000,
      points: 20000
    },
    mapPosition: { x: 50, y: 85 }
  }
]

// ==================== 章节配置 ====================
// chapter 6: star navigation
const chapter6Quests: CampaignQuestConfig[] = [
  {
    id: 'quest_6_1',
    chapter: 6,
    order: 1,
    titleKey: 'campaign.quests.6_1.title',
    descriptionKey: 'campaign.quests.6_1.description',
    requiredQuestIds: ['quest_5_5'],
    prologueDialogues: [
      { id: 'quest_6_1_prologue_1', speaker: 'narrator', textKey: 'campaign.dialogues.6_1.prologue_1' }
    ],
    objectives: [
      { id: 'obj_6_1_1', type: ObjectiveType.ScanSystem, target: 'any', descriptionKey: 'campaign.objectiveDescriptions.scanSystem', required: 1 }
    ],
    rewards: { resources: { metal: 5000, crystal: 2500, deuterium: 1000 }, darkMatter: 50, points: 100 },
    mapPosition: { x: 20, y: 80 }
  },
  {
    id: 'quest_6_2',
    chapter: 6,
    order: 2,
    titleKey: 'campaign.quests.6_2.title',
    descriptionKey: 'campaign.quests.6_2.description',
    requiredQuestIds: ['quest_6_1'],
    prologueDialogues: [
      { id: 'quest_6_2_prologue_1', speaker: 'narrator', textKey: 'campaign.dialogues.6_2.prologue_1' }
    ],
    objectives: [
      { id: 'obj_6_2_1', type: ObjectiveType.NameSystem, target: 'any', descriptionKey: 'campaign.objectiveDescriptions.nameSystem', required: 1 }
    ],
    rewards: { resources: { metal: 6000, crystal: 3000, deuterium: 1200 }, darkMatter: 60, points: 120 },
    mapPosition: { x: 35, y: 88 }
  },
  {
    id: 'quest_6_3',
    chapter: 6,
    order: 3,
    titleKey: 'campaign.quests.6_3.title',
    descriptionKey: 'campaign.quests.6_3.description',
    requiredQuestIds: ['quest_6_2'],
    prologueDialogues: [
      { id: 'quest_6_3_prologue_1', speaker: 'narrator', textKey: 'campaign.dialogues.6_3.prologue_1' }
    ],
    objectives: [
      { id: 'obj_6_3_1', type: ObjectiveType.CollectSignal, target: 'any', descriptionKey: 'campaign.objectiveDescriptions.collectSignal', required: 1 }
    ],
    rewards: { resources: { metal: 7000, crystal: 3500, deuterium: 1400 }, darkMatter: 70, points: 140 },
    mapPosition: { x: 50, y: 92 }
  },
  {
    id: 'quest_6_4',
    chapter: 6,
    order: 4,
    titleKey: 'campaign.quests.6_4.title',
    descriptionKey: 'campaign.quests.6_4.description',
    requiredQuestIds: ['quest_6_3'],
    prologueDialogues: [
      { id: 'quest_6_4_prologue_1', speaker: 'narrator', textKey: 'campaign.dialogues.6_4.prologue_1' }
    ],
    objectives: [
      { id: 'obj_6_4_1', type: ObjectiveType.CaptureGate, target: 'any', descriptionKey: 'campaign.objectiveDescriptions.captureGate', required: 1 }
    ],
    rewards: { resources: { metal: 9000, crystal: 4500, deuterium: 1800 }, darkMatter: 90, points: 180 },
    mapPosition: { x: 65, y: 88 }
  },
  {
    id: 'quest_6_5',
    chapter: 6,
    order: 5,
    titleKey: 'campaign.quests.6_5.title',
    descriptionKey: 'campaign.quests.6_5.description',
    requiredQuestIds: ['quest_6_4'],
    prologueDialogues: [
      { id: 'quest_6_5_prologue_1', speaker: 'narrator', textKey: 'campaign.dialogues.6_5.prologue_1' }
    ],
    objectives: [
      { id: 'obj_6_5_1', type: ObjectiveType.CycleJump, target: 'any', descriptionKey: 'campaign.objectiveDescriptions.cycleJump', required: 1 }
    ],
    rewards: { resources: { metal: 15000, crystal: 7500, deuterium: 3000 }, darkMatter: 150, points: 300 },
    mapPosition: { x: 80, y: 80 }
  }
]

// ==================== 第七章：星际商路 ====================
// 将玩家交易内容接入主线：航空港 → 超时空转移 → 扩容 → 成熟的跨星系商路
const chapter7Quests: CampaignQuestConfig[] = [
  {
    id: 'quest_7_1',
    chapter: 7,
    order: 1,
    titleKey: 'campaign.quests.7_1.title',
    descriptionKey: 'campaign.quests.7_1.description',
    requiredQuestIds: ['quest_6_5'],
    prologueDialogues: [
      { id: 'quest_7_1_prologue_1', speaker: 'narrator', textKey: 'campaign.dialogues.7_1.prologue_1' }
    ],
    objectives: [
      {
        id: 'obj_7_1_1',
        type: ObjectiveType.BuildBuilding,
        descriptionKey: 'campaign.objectiveDescriptions.buildSpaceport',
        target: BuildingType.Spaceport,
        targetSecondary: 1,
        required: 1
      }
    ],
    rewards: { resources: { metal: 20000, crystal: 12000, deuterium: 5000 }, darkMatter: 200, points: 400 },
    mapPosition: { x: 20, y: 30 }
  },
  {
    id: 'quest_7_2',
    chapter: 7,
    order: 2,
    titleKey: 'campaign.quests.7_2.title',
    descriptionKey: 'campaign.quests.7_2.description',
    requiredQuestIds: ['quest_7_1'],
    prologueDialogues: [
      { id: 'quest_7_2_prologue_1', speaker: 'mysterious', speakerNameKey: 'campaign.speakers.ancientVoice', textKey: 'campaign.dialogues.7_2.prologue_1' }
    ],
    objectives: [
      {
        id: 'obj_7_2_1',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchHyperspaceTransfer',
        target: TechnologyType.HyperspaceTransfer,
        targetSecondary: 1,
        required: 1
      }
    ],
    rewards: { resources: { metal: 25000, crystal: 18000, deuterium: 8000 }, darkMatter: 250, points: 500 },
    mapPosition: { x: 38, y: 25 }
  },
  {
    id: 'quest_7_3',
    chapter: 7,
    order: 3,
    titleKey: 'campaign.quests.7_3.title',
    descriptionKey: 'campaign.quests.7_3.description',
    requiredQuestIds: ['quest_7_2'],
    prologueDialogues: [
      { id: 'quest_7_3_prologue_1', speaker: 'narrator', textKey: 'campaign.dialogues.7_3.prologue_1' }
    ],
    objectives: [
      {
        id: 'obj_7_3_1',
        type: ObjectiveType.BuildBuilding,
        descriptionKey: 'campaign.objectiveDescriptions.buildSpaceport',
        target: BuildingType.Spaceport,
        targetSecondary: 3,
        required: 1
      }
    ],
    rewards: { resources: { metal: 40000, crystal: 28000, deuterium: 12000 }, darkMatter: 350, points: 700 },
    mapPosition: { x: 56, y: 30 }
  },
  {
    id: 'quest_7_4',
    chapter: 7,
    order: 4,
    titleKey: 'campaign.quests.7_4.title',
    descriptionKey: 'campaign.quests.7_4.description',
    requiredQuestIds: ['quest_7_3'],
    prologueDialogues: [
      { id: 'quest_7_4_prologue_1', speaker: 'narrator', textKey: 'campaign.dialogues.7_4.prologue_1' }
    ],
    objectives: [
      {
        id: 'obj_7_4_1',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchHyperspaceTransfer',
        target: TechnologyType.HyperspaceTransfer,
        targetSecondary: 3,
        required: 1
      }
    ],
    rewards: { resources: { metal: 60000, crystal: 42000, deuterium: 18000 }, darkMatter: 500, points: 1000 },
    mapPosition: { x: 70, y: 45 }
  },
  {
    id: 'quest_7_5',
    chapter: 7,
    order: 5,
    titleKey: 'campaign.quests.7_5.title',
    descriptionKey: 'campaign.quests.7_5.description',
    requiredQuestIds: ['quest_7_4'],
    prologueDialogues: [
      { id: 'quest_7_5_prologue_1', speaker: 'narrator', textKey: 'campaign.dialogues.7_5.prologue_1' }
    ],
    epilogueDialogues: [
      { id: 'quest_7_5_epilogue_1', speaker: 'mysterious', speakerNameKey: 'campaign.speakers.ancientVoice', textKey: 'campaign.dialogues.7_5.epilogue_1' }
    ],
    objectives: [
      {
        id: 'obj_7_5_1',
        type: ObjectiveType.BuildBuilding,
        descriptionKey: 'campaign.objectiveDescriptions.buildSpaceport',
        target: BuildingType.Spaceport,
        targetSecondary: 5,
        required: 1
      },
      {
        id: 'obj_7_5_2',
        type: ObjectiveType.ResearchTech,
        descriptionKey: 'campaign.objectiveDescriptions.researchHyperspaceTransfer',
        target: TechnologyType.HyperspaceTransfer,
        targetSecondary: 5,
        required: 1
      }
    ],
    rewards: { resources: { metal: 120000, crystal: 90000, deuterium: 50000 }, darkMatter: 1000, points: 2500 },
    mapPosition: { x: 80, y: 70 }
  }
]

const chapters: CampaignChapterConfig[] = [
  {
    id: 'chapter_1',
    number: 1,
    titleKey: 'campaign.chapters.1.title',
    descriptionKey: 'campaign.chapters.1.description',
    backgroundStoryKey: 'campaign.chapters.1.backgroundStory',
    quests: chapter1Quests
  },
  {
    id: 'chapter_2',
    number: 2,
    titleKey: 'campaign.chapters.2.title',
    descriptionKey: 'campaign.chapters.2.description',
    backgroundStoryKey: 'campaign.chapters.2.backgroundStory',
    quests: chapter2Quests
  },
  {
    id: 'chapter_3',
    number: 3,
    titleKey: 'campaign.chapters.3.title',
    descriptionKey: 'campaign.chapters.3.description',
    backgroundStoryKey: 'campaign.chapters.3.backgroundStory',
    quests: chapter3Quests
  },
  {
    id: 'chapter_4',
    number: 4,
    titleKey: 'campaign.chapters.4.title',
    descriptionKey: 'campaign.chapters.4.description',
    backgroundStoryKey: 'campaign.chapters.4.backgroundStory',
    quests: chapter4Quests
  },
  {
    id: 'chapter_5',
    number: 5,
    titleKey: 'campaign.chapters.5.title',
    descriptionKey: 'campaign.chapters.5.description',
    backgroundStoryKey: 'campaign.chapters.5.backgroundStory',
    quests: chapter5Quests
  },
  {
    id: 'chapter_6',
    number: 6,
    titleKey: 'campaign.chapters.6.title',
    descriptionKey: 'campaign.chapters.6.description',
    backgroundStoryKey: 'campaign.chapters.6.backgroundStory',
    quests: chapter6Quests
  },
  {
    id: 'chapter_7',
    number: 7,
    titleKey: 'campaign.chapters.7.title',
    descriptionKey: 'campaign.chapters.7.description',
    backgroundStoryKey: 'campaign.chapters.7.backgroundStory',
    quests: chapter7Quests
  }
]

// ==================== 主战役配置 ====================
export const MAIN_CAMPAIGN: CampaignConfig = {
  id: 'main_campaign',
  nameKey: 'campaign.name',
  descriptionKey: 'campaign.description',
  chapters
}

// 获取所有任务的扁平列表
export const getAllQuests = (): CampaignQuestConfig[] => {
  return MAIN_CAMPAIGN.chapters.flatMap(chapter => chapter.quests)
}

// 根据ID获取任务配置
export const getQuestById = (questId: string): CampaignQuestConfig | undefined => {
  return getAllQuests().find(quest => quest.id === questId)
}

// 根据章节获取任务列表
export const getQuestsByChapter = (chapterNumber: number): CampaignQuestConfig[] => {
  const chapter = MAIN_CAMPAIGN.chapters.find(c => c.number === chapterNumber)
  return chapter?.quests || []
}

// 获取章节配置
export const getChapterById = (chapterId: string): CampaignChapterConfig | undefined => {
  return MAIN_CAMPAIGN.chapters.find(chapter => chapter.id === chapterId)
}

// 获取总任务数
export const getTotalQuestCount = (): number => {
  return getAllQuests().length
}
