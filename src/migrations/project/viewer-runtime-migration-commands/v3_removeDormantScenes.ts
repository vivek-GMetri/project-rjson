import { RT, rtp, RecordNode } from "../../../r/R/index.js";
import { RF } from "../../../r/index.js";
import { IOrder } from "../../IOrder.js";
import { RuleAction } from "../../../r/definitions/rules/index.js";
import { ElementType } from "../../../r/definitions/elements/index.js";

class Migration implements IOrder {
  execute (projectJson: any) {
    return migrateProject(projectJson);
  }
}

/**
 * Remove scenes thare are not:
 * 1) Initial scene
 * 2) In the menu
 * 3) Referenced in rules "change_to_scene"
 * 4) Referenced in hotspot rules
 */
const migrateProject = (json: any) => {
  const pf = new RF.ProjectFactory(json as RecordNode<RT.project>);
  const sceneIdsToDelete = pf.getRecordIds(RT.scene);
  const keepScene = (sceneId: number) => {
    const index = sceneIdsToDelete.indexOf(sceneId);
    if(index !== -1) {
      sceneIdsToDelete.splice(index, 1);
    }
  }

  //Initial scene
  const initialSceneId = pf.getInitialSceneId();
  keepScene(initialSceneId);

  //In the menu
  for(const menu of pf.getRecords(RT.menu)) {
    const menuF = new RF.RecordFactory(menu);
    if(menuF.getValueOrDefault(rtp.menu.menu_show) === true) {
      const linkedSceneId = menuF.get(rtp.menu.menu_scene_id);
      if(typeof linkedSceneId === "number") {
        keepScene(linkedSceneId);
      }
    }
  }

  const scenes = pf.getRecords(RT.scene);
  for(const s of scenes) {
    const sceneF = new RF.SceneFactory(s);
    //In change_scene rules
    const thenActionEntries = sceneF.getDeepRecordEntries(RT.then_action);
    for(const [taId, ta] of thenActionEntries) {
      const taF = new RF.RecordFactory(ta);
      if(taF.get(rtp.then_action.action) === RuleAction.change_scene) {
        const destinationSceneId = (taF.get(rtp.then_action.ta_properties) as number[])?.[0];
        if(typeof destinationSceneId === "number") {
          keepScene(destinationSceneId);
        }
      }
    }

    //In hotspot elements
    const deepElementEntries = sceneF.getDeepRecordEntries(RT.element);
    for(const [eId, e] of deepElementEntries) {
      const elementF = new RF.ElementFactory(e);
      if(elementF.getElementType() === ElementType.hotspot) {
        const targetSceneId = elementF.get(rtp.element.target_scene_id);
        if(typeof targetSceneId === "number") {
          keepScene(targetSceneId);
        }
      }
    }
  }

  //Delete scenes in sceneIdsToDelete
  for(const sceneId of sceneIdsToDelete) {
    pf.deleteRecord(sceneId, RT.scene);
  }

  return json;
}

const migration = new Migration();
export default migration;
