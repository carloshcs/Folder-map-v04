/**
 * Manual orbital layout between primary (Folder Fox) and secondaries (integrations).
 * - No D3 forces.
 * - Even angular spacing between secondaries (e.g., 90° for 4).
 * - Click/drag secondary → move freely → on release it smoothly returns to orbit.
 */

export function createManualPhysics(
  nodes: any[],
  onTick: () => void,
  RADIUS_PRIMARY_TO_SECONDARY = 200,
  NODE_RADIUS = 30
) {
  const folderFox = nodes.find(n => n.data?.name === 'Folder Fox');
  const integrations = nodes.filter(
    n =>
      n.parent === folderFox &&
      ['Google Drive', 'Dropbox', 'OneDrive', 'Notion'].includes(n.data?.name)
  );

  if (folderFox) {
    folderFox.x = 0;
    folderFox.y = 0;
    folderFox.isPrimary = true;
  }

  const total = integrations.length;
  const angleStep = (2 * Math.PI) / total;

  // Initial angular placement
  integrations.forEach((node, i) => {
    const angle = i * angleStep - Math.PI / 2;
    node.orbitAngle = angle;
    node.targetX = Math.cos(angle) * RADIUS_PRIMARY_TO_SECONDARY;
    node.targetY = Math.sin(angle) * RADIUS_PRIMARY_TO_SECONDARY;
    node.x = node.targetX;
    node.y = node.targetY;
    node.isSecondary = true;
  });

  const SMOOTH_SPEED = 0.15; // controls how fast it returns to orbit

  let animationId: number;

  function animate() {
    // Only secondaries need animation toward their orbit target
    integrations.forEach(node => {
      if (node.isDragging) return; // skip while dragging

      // Smooth interpolation back to target orbit
      node.x += (node.targetX - node.x) * SMOOTH_SPEED;
      node.y += (node.targetY - node.y) * SMOOTH_SPEED;
    });

    onTick();
    animationId = requestAnimationFrame(animate);
  }

  animate();

  // --- Drag Handlers ---
  function onDragStart(node: any) {
    node.isDragging = true;
  }

  function onDrag(node: any, x: number, y: number) {
    node.x = x;
    node.y = y;
  }

  function onDragEnd(node: any) {
    node.isDragging = false;

    // Reset target orbit position when released
    if (node.isSecondary && folderFox) {
      node.targetX = folderFox.x + Math.cos(node.orbitAngle) * RADIUS_PRIMARY_TO_SECONDARY;
      node.targetY = folderFox.y + Math.sin(node.orbitAngle) * RADIUS_PRIMARY_TO_SECONDARY;
    }
  }

  return {
    stop: () => cancelAnimationFrame(animationId),
    dragHandlers: {
      onDragStart,
      onDrag,
      onDragEnd,
    },
  };
}
