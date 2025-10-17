/**
 * Manual orbital layout (no D3 physics).
 * - Folder Fox fixed center.
 * - Integrations evenly spaced around it.
 * - Click-drag a secondary: it moves freely.
 * - On release, it smoothly returns to its orbit.
 */

export function createManualPhysics(
  nodes: any[],
  onTick: () => void,
  RADIUS_PRIMARY_TO_SECONDARY = 200,
  NODE_RADIUS = 30
) {
  const folderFox = nodes.find(n => n?.data?.name === 'Folder Fox');
  const integrations = nodes.filter(
    n =>
      n?.parent === folderFox &&
      ['Google Drive', 'Dropbox', 'OneDrive', 'Notion'].includes(n?.data?.name)
  );

  if (folderFox) {
    folderFox.x = 0;
    folderFox.y = 0;
    folderFox.isPrimary = true;
  }

  const total = integrations.length || 1;
  const angleStep = (2 * Math.PI) / total;

  // --- Initial placement of integrations ---
  integrations.forEach((node, i) => {
    const angle = i * angleStep - Math.PI / 2;
    node.orbitAngle = angle;
    const cx = folderFox ? folderFox.x : 0;
    const cy = folderFox ? folderFox.y : 0;
    node.targetX = cx + Math.cos(angle) * RADIUS_PRIMARY_TO_SECONDARY;
    node.targetY = cy + Math.sin(angle) * RADIUS_PRIMARY_TO_SECONDARY;
    node.x = node.targetX;
    node.y = node.targetY;
    node.isSecondary = true;
  });

  // --- Constants ---
  const RETURN_SPEED = 0.12; // smoothness of return motion
  let animationId: number;

  // --- Animation Loop ---
  function animate() {
    integrations.forEach(node => {
      if (node.isDragging) return; // don't update while dragging
      node.x += (node.targetX - node.x) * RETURN_SPEED;
      node.y += (node.targetY - node.y) * RETURN_SPEED;
    });

    onTick();
    animationId = requestAnimationFrame(animate);
  }

  animate();

  // --- Drag Handlers ---
  function onDragStart(node: any) {
    if (!node?.isSecondary) return;
    node.isDragging = true;
  }

  function onDrag(node: any, x: number, y: number) {
    if (!node?.isSecondary) return;
    node.x = x;
    node.y = y;
  }

  function onDragEnd(node: any) {
    if (!node?.isSecondary) return;
    node.isDragging = false;

    const cx = folderFox ? folderFox.x : 0;
    const cy = folderFox ? folderFox.y : 0;
    node.targetX = cx + Math.cos(node.orbitAngle) * RADIUS_PRIMARY_TO_SECONDARY;
    node.targetY = cy + Math.sin(node.orbitAngle) * RADIUS_PRIMARY_TO_SECONDARY;
  }

  return {
    stop: () => cancelAnimationFrame(animationId),
    dragHandlers: { onDragStart, onDrag, onDragEnd },
  };
}
