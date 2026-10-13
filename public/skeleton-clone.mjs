function parallelTraverse(source, clone, visit) {
  visit(source, clone);
  for (let index = 0; index < source.children.length; index += 1) {
    parallelTraverse(source.children[index], clone.children[index], visit);
  }
}

// Object3D.clone() copies a SkinnedMesh but retains its source Skeleton.
// Rebind every clone to the matching cloned bones so each character can be
// positioned and animated independently in the live scene.
export function cloneSkinnedScene(source) {
  if (!source?.clone) return null;
  const sourceByClone = new Map();
  const cloneBySource = new Map();
  const clone = source.clone(true);
  parallelTraverse(source, clone, (sourceNode, cloneNode) => {
    sourceByClone.set(cloneNode, sourceNode);
    cloneBySource.set(sourceNode, cloneNode);
  });
  clone.traverse(node => {
    if (!node.isSkinnedMesh) return;
    const sourceMesh = sourceByClone.get(node);
    if (!sourceMesh?.skeleton) return;
    const skeleton = sourceMesh.skeleton.clone();
    skeleton.bones = sourceMesh.skeleton.bones.map(bone => cloneBySource.get(bone));
    node.bindMatrix.copy(sourceMesh.bindMatrix);
    node.bind(skeleton, node.bindMatrix);
  });
  return clone;
}
