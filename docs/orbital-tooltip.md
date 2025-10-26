# Orbital Map Tooltip Integration Guide

This guide describes how to implement a consistently positioned tooltip for nodes in the Orbital Map visualization that is rendered with D3.js and controlled from Java.

## HTML Structure

Add a floating tooltip container that lives alongside your SVG element. The tooltip stays hidden until a node is hovered.

```html
<div id="orbital-tooltip" class="orbital-tooltip orbital-tooltip--hidden">
  <div class="orbital-tooltip__content"></div>
  <div class="orbital-tooltip__pointer"></div>
</div>
```

## CSS

```css
.orbital-tooltip {
  position: absolute;
  min-width: 180px;
  max-width: 320px;
  padding: 12px 16px;
  background: rgba(14, 21, 32, 0.95);
  color: #f8fafc;
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  transform: translateZ(0);
  transition: opacity 120ms ease-in-out;
  opacity: 0;
  z-index: 20;
}

.orbital-tooltip__pointer {
  position: absolute;
  left: 50%;
  bottom: -10px;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid rgba(14, 21, 32, 0.95);
}

.orbital-tooltip--visible {
  opacity: 1;
}

.orbital-tooltip--hidden {
  display: none;
}
```

## JavaScript

```javascript
const svg = d3.select('#orbital-map');
const tooltip = d3.select('#orbital-tooltip');
const tooltipContent = tooltip.select('.orbital-tooltip__content');
const nodeRadius = 12; // keep in sync with your circle radius

const zoom = d3.zoom()
  .scaleExtent([0.25, 6])
  .on('zoom', (event) => {
    zoomLayer.attr('transform', event.transform);
    updateTooltipPosition();
  });

svg.call(zoom);

function showTooltip(nodeDatum) {
  tooltipContent.html(renderTooltipHtml(nodeDatum));
  tooltip.classed('orbital-tooltip--hidden', false)
         .classed('orbital-tooltip--visible', true);
  updateTooltipPosition(nodeDatum);
}

function hideTooltip() {
  tooltip.classed('orbital-tooltip--visible', false)
         .classed('orbital-tooltip--hidden', true);
}

function updateTooltipPosition(nodeDatum) {
  if (!nodeDatum || tooltip.classed('orbital-tooltip--hidden')) {
    return;
  }

  const transform = d3.zoomTransform(svg.node());
  const [x, y] = transform.apply([nodeDatum.x, nodeDatum.y]);
  const { width, height } = tooltip.node().getBoundingClientRect();

  tooltip.style('left', `${x - width / 2}px`)
         .style('top', `${y - nodeRadius - height - 10}px`);
}

const nodes = zoomLayer.selectAll('circle.node')
  .data(nodeData)
  .join('circle')
  .classed('node', true)
  .attr('r', nodeRadius)
  .attr('cx', (d) => d.x)
  .attr('cy', (d) => d.y)
  .on('mouseover', (event, d) => {
    showTooltip(d);
  })
  .on('mousemove', (event, d) => {
    updateTooltipPosition(d);
  })
  .on('mouseout', () => {
    hideTooltip();
  });

zoomLayer.on('click', hideTooltip);
```

### Integration notes

* `zoomLayer` is the `<g>` element inside the SVG that receives zoom transforms.
* `renderTooltipHtml` should produce the HTML content for the tooltip based on your node model.
* Call `updateTooltipPosition(currentNodeDatum)` from Java whenever the node data or highlighted selection changes.
* When the Java side triggers zoom or pan (through `zoom.transform(...)`), ensure you invoke `updateTooltipPosition(currentNodeDatum)` afterward to keep the tooltip anchored.

## Java Interop

From Java, expose the current node metadata to the web view so that the D3 layer can call `showTooltip(nodeDatum)` whenever a node gains focus. If you are using a Java→JS bridge, deliver the node payload and let the JavaScript helper toggle the tooltip visibility.

On zoom or pan commands initiated from Java (for example, `zoomBehavior.scaleTo(...)`), schedule a `requestAnimationFrame(() -> updateTooltipPosition(currentNodeDatum));` in JavaScript to ensure the DOM has the latest transform before recalculating the tooltip position.

## Event Lifecycle Summary

1. **Mouseover node:** `showTooltip` renders HTML, toggles classes, and positions the tooltip using the current zoom transform.
2. **Mousemove/zoom/pan:** `updateTooltipPosition` reprojects logical coordinates and repositions the tooltip.
3. **Mouseout or background click:** `hideTooltip` removes the tooltip.
4. **Programmatic focus changes:** call `showTooltip` / `hideTooltip` from JavaScript handlers triggered by your Java integration.

This approach keeps the tooltip visually tethered to the node, regardless of zoom level or pan offset, and aligns with the Orbital Map's interactive requirements.
