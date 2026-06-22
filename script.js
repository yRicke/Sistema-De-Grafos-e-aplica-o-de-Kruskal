const statusMessage = document.getElementById("status-message");
const logContent = document.getElementById("log-content");
const runKruskalButton = document.getElementById("run-kruskal-button");

const state = {
  cy: null,
  nextNodeNumber: 1,
  pendingSourceId: null
};

class UnionFind {
  constructor(nodeIds) {
    this.parent = new Map();
    this.rank = new Map();

    nodeIds.forEach((nodeId) => {
      this.parent.set(nodeId, nodeId);
      this.rank.set(nodeId, 0);
    });
  }

  find(nodeId) {
    const parent = this.parent.get(nodeId);

    if (parent !== nodeId) {
      const representative = this.find(parent);
      this.parent.set(nodeId, representative);
      return representative;
    }

    return parent;
  }

  union(nodeAId, nodeBId) {
    const rootA = this.find(nodeAId);
    const rootB = this.find(nodeBId);

    if (rootA === rootB) {
      return false;
    }

    const rankA = this.rank.get(rootA);
    const rankB = this.rank.get(rootB);

    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }

    return true;
  }

  getSets(nodeElements) {
    const groups = new Map();

    sortNodeElements(nodeElements).forEach((node) => {
      const representative = this.find(node.id());
      const currentGroup = groups.get(representative) ?? [];
      currentGroup.push(node.data("label"));
      groups.set(representative, currentGroup);
    });

    return Array.from(groups.values())
      .map((group) => group.sort(compareLabels))
      .sort((groupA, groupB) => compareLabels(groupA[0], groupB[0]));
  }
}

function compareLabels(labelA, labelB) {
  return labelA.localeCompare(labelB, "pt-BR", {
    numeric: true,
    sensitivity: "base"
  });
}

function formatWeight(weight) {
  const numericWeight = Number(weight);

  if (Number.isInteger(numericWeight)) {
    return String(numericWeight);
  }

  return numericWeight.toFixed(2).replace(/\.?0+$/, "");
}

function sortNodeElements(nodesCollection) {
  return [...nodesCollection].sort((nodeA, nodeB) =>
    compareLabels(nodeA.data("label"), nodeB.data("label"))
  );
}

function sortEdgeElements(edgeCollection) {
  return [...edgeCollection].sort((edgeA, edgeB) => {
    const weightDifference = Number(edgeA.data("weight")) - Number(edgeB.data("weight"));

    if (weightDifference !== 0) {
      return weightDifference;
    }

    const edgeALabel = formatEdgeLabel(edgeA);
    const edgeBLabel = formatEdgeLabel(edgeB);
    return compareLabels(edgeALabel, edgeBLabel);
  });
}

function formatSetList(sets) {
  if (sets.length === 0) {
    return "{ }";
  }

  return sets.map((set) => `{${set.join(", ")}}`).join(", ");
}

function formatASet(edgesInA) {
  if (edgesInA.length === 0) {
    return "{ }";
  }

  return `{ ${edgesInA.join(", ")} }`;
}

function formatEdgeLabel(edge) {
  const sourceLabel = state.cy.getElementById(edge.data("source")).data("label");
  const targetLabel = state.cy.getElementById(edge.data("target")).data("label");
  return `(${sourceLabel}, ${targetLabel})`;
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function renderIdleLog(message) {
  logContent.innerHTML = `
    <div class="log-empty">
      ${message}
    </div>
  `;
}

function renderLog(entries) {
  logContent.innerHTML = entries.map((entry) => {
    if (entry.type === "start") {
      return `
        <section class="log-entry">
          <span class="log-key">Início do Algoritmo</span>
          <p><strong>Conjunto A</strong> = <span class="mono">${entry.aSet}</span></p>
          <p><strong>Conjuntos Iniciais:</strong></p>
          <p class="mono">${entry.sets}</p>
        </section>
      `;
    }

    if (entry.type === "iteration") {
      return `
        <section class="log-entry ${entry.accepted ? "success" : "discarded"}">
          <h3>Iteração ${entry.step}</h3>
          <p><strong>Menor aresta disponível:</strong> <span class="mono">${entry.edge}</span> com peso <span class="mono">${entry.weight}</span>.</p>
          <p>${entry.message}</p>
          <p><strong>Conjunto A</strong> = <span class="mono">${entry.aSet}</span></p>
          <p><strong>Conjuntos Atuais:</strong></p>
          <p class="mono">${entry.sets}</p>
        </section>
      `;
    }

    return `
      <section class="log-entry finish">
        <span class="log-key">Fim do Algoritmo</span>
        <p>${entry.message}</p>
        <p><strong>Conjunto A final</strong> = <span class="mono">${entry.aSet}</span></p>
        <p><strong>Conjuntos finais:</strong></p>
        <p class="mono">${entry.sets}</p>
      </section>
    `;
  }).join("");
}

function clearPendingSource() {
  if (!state.pendingSourceId) {
    return;
  }

  state.cy.getElementById(state.pendingSourceId).removeClass("source-node");
  state.pendingSourceId = null;
}

function resetKruskalView(message) {
  state.cy.edges().removeClass("mst-edge");

  if (message) {
    renderIdleLog(message);
  }
}

function calculateEuclideanWeight(sourceNode, targetNode) {
  const dx = sourceNode.position("x") - targetNode.position("x");
  const dy = sourceNode.position("y") - targetNode.position("y");
  return Math.round(Math.sqrt((dx * dx) + (dy * dy)));
}

function edgeAlreadyExists(sourceId, targetId) {
  return state.cy.edges().some((edge) => {
    const edgeSource = edge.data("source");
    const edgeTarget = edge.data("target");

    return (
      (edgeSource === sourceId && edgeTarget === targetId) ||
      (edgeSource === targetId && edgeTarget === sourceId)
    );
  });
}

function addNode(position) {
  const label = `N${state.nextNodeNumber}`;
  state.nextNodeNumber += 1;

  state.cy.add({
    group: "nodes",
    data: {
      id: label,
      label
    },
    position
  });

  resetKruskalView("Grafo alterado. Execute Kruskal para gerar um novo log.");
  setStatus(`${label} criado. Clique em outro ponto para adicionar mais nós.`);
}

function addEdge(sourceNode, targetNode) {
  const sourceId = sourceNode.id();
  const targetId = targetNode.id();

  if (sourceId === targetId) {
    clearPendingSource();
    setStatus("Selecione dois nós diferentes para criar uma aresta.");
    return;
  }

  if (edgeAlreadyExists(sourceId, targetId)) {
    clearPendingSource();
    setStatus("Já existe uma aresta entre esses dois nós.");
    return;
  }

  const weight = calculateEuclideanWeight(sourceNode, targetNode);

  state.cy.add({
    group: "edges",
    data: {
      id: `${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      weight,
      weightLabel: formatWeight(weight)
    }
  });

  clearPendingSource();
  resetKruskalView("Grafo alterado. Execute Kruskal para gerar um novo log.");
  setStatus(`Aresta criada entre ${sourceNode.data("label")} e ${targetNode.data("label")} com peso ${formatWeight(weight)}.`);
}

function promptForEdgeWeight(edge) {
  const currentWeight = edge.data("weight");
  const input = window.prompt("Informe o novo peso da aresta:", String(currentWeight));

  if (input === null) {
    return;
  }

  const parsedWeight = Number(input.replace(",", "."));

  if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
    setStatus("Peso inválido. Informe um valor numérico maior ou igual a zero.");
    return;
  }

  edge.data({
    weight: parsedWeight,
    weightLabel: formatWeight(parsedWeight)
  });

  resetKruskalView("Grafo alterado. Execute Kruskal para gerar um novo log.");
  setStatus(`Peso da aresta ${formatEdgeLabel(edge)} atualizado para ${formatWeight(parsedWeight)}.`);
}

function removeElement(element) {
  const description = element.isNode()
    ? `Nó ${element.data("label")} removido.`
    : `Aresta ${formatEdgeLabel(element)} removida.`;

  if (element.isNode() && element.id() === state.pendingSourceId) {
    clearPendingSource();
  }

  state.cy.remove(element);
  resetKruskalView("Grafo alterado. Execute Kruskal para gerar um novo log.");
  setStatus(description);
}

function executeKruskal() {
  clearPendingSource();
  state.cy.edges().removeClass("mst-edge");

  const nodes = sortNodeElements(state.cy.nodes());
  const edges = sortEdgeElements(state.cy.edges());

  if (nodes.length === 0) {
    renderIdleLog("Adicione pelo menos um nó para executar o algoritmo.");
    setStatus("Ainda não há nós no grafo.");
    return;
  }

  if (edges.length === 0) {
    renderIdleLog("Adicione arestas ao grafo para executar o algoritmo de Kruskal.");
    setStatus("Ainda não há arestas no grafo.");
    return;
  }

  const unionFind = new UnionFind(nodes.map((node) => node.id()));
  const logEntries = [{
    type: "start",
    aSet: formatASet([]),
    sets: formatSetList(unionFind.getSets(nodes))
  }];
  const aSet = [];
  const mstEdgeIds = [];

  edges.forEach((edge, index) => {
    const sourceId = edge.data("source");
    const targetId = edge.data("target");
    const sourceLabel = state.cy.getElementById(sourceId).data("label");
    const targetLabel = state.cy.getElementById(targetId).data("label");
    const edgeLabel = `(${sourceLabel}, ${targetLabel})`;
    const sameSet = unionFind.find(sourceId) === unionFind.find(targetId);

    if (!sameSet) {
      unionFind.union(sourceId, targetId);
      aSet.push(edgeLabel);
      mstEdgeIds.push(edge.id());
    }

    logEntries.push({
      type: "iteration",
      step: index + 1,
      edge: edgeLabel,
      weight: formatWeight(edge.data("weight")),
      accepted: !sameSet,
      message: sameSet
        ? "Vértices já estão no mesmo conjunto. Forma ciclo, aresta ignorada."
        : "Vértices em conjuntos diferentes. Aresta adicionada a A.",
      aSet: formatASet(aSet),
      sets: formatSetList(unionFind.getSets(nodes))
    });
  });

  const finalSets = unionFind.getSets(nodes);
  const componentCount = finalSets.length;
  const finishMessage = componentCount === 1
    ? "Árvore Geradora Mínima concluída."
    : `Floresta Geradora Mínima concluída com ${componentCount} componentes.`;

  logEntries.push({
    type: "finish",
    message: finishMessage,
    aSet: formatASet(aSet),
    sets: formatSetList(finalSets)
  });

  mstEdgeIds.forEach((edgeId) => {
    state.cy.getElementById(edgeId).addClass("mst-edge");
  });

  renderLog(logEntries);
  setStatus(componentCount === 1
    ? "Execução concluída. As arestas da MST foram destacadas em verde."
    : "Execução concluída. O grafo possui mais de uma componente, então foi gerada uma floresta mínima.");
}

function initializeCytoscape() {
  const cy = cytoscape({
    container: document.getElementById("cy"),
    wheelSensitivity: 0.2,
    style: [
      {
        selector: "node",
        style: {
          "background-color": "#d08d31",
          "border-width": 3,
          "border-color": "#fff7eb",
          "label": "data(label)",
          "color": "#1f1a11",
          "font-size": 14,
          "font-weight": 700,
          "text-valign": "center",
          "text-halign": "center",
          "width": 52,
          "height": 52
        }
      },
      {
        selector: "node.source-node",
        style: {
          "background-color": "#ffb44d",
          "border-color": "#8b4a00",
          "border-width": 5
        }
      },
      {
        selector: "edge",
        style: {
          "width": 3.5,
          "line-color": "#6b7c8f",
          "curve-style": "bezier",
          "label": "data(weightLabel)",
          "font-size": 12,
          "color": "#22313f",
          "text-background-color": "#fffdf9",
          "text-background-opacity": 1,
          "text-background-padding": 4,
          "text-border-color": "#d9cbb2",
          "text-border-width": 1,
          "text-rotation": "autorotate"
        }
      },
      {
        selector: "edge.mst-edge",
        style: {
          "line-color": "#1a8b72",
          "width": 5,
          "color": "#115748",
          "font-weight": 700
        }
      }
    ],
    elements: []
  });

  state.cy = cy;

  cy.on("tap", (event) => {
    if (event.target === cy) {
      addNode(event.position);
    }
  });

  cy.on("tap", "node", (event) => {
    const clickedNode = event.target;

    if (!state.pendingSourceId) {
      state.pendingSourceId = clickedNode.id();
      clickedNode.addClass("source-node");
      setStatus(`${clickedNode.data("label")} selecionado. Clique em outro nó para criar a aresta.`);
      return;
    }

    if (state.pendingSourceId === clickedNode.id()) {
      clearPendingSource();
      setStatus("Seleção cancelada.");
      return;
    }

    const sourceNode = state.cy.getElementById(state.pendingSourceId);
    addEdge(sourceNode, clickedNode);
  });

  cy.on("tap", "edge", (event) => {
    promptForEdgeWeight(event.target);
  });

  cy.on("cxttap taphold", "node, edge", (event) => {
    removeElement(event.target);
  });
}

document.getElementById("cy").addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

runKruskalButton.addEventListener("click", executeKruskal);

initializeCytoscape();
renderIdleLog("Monte o grafo no painel à esquerda e clique em “Executar Kruskal” para gerar o log passo a passo.");
setStatus("Clique no painel para criar o primeiro nó.");

window.__kruskalApp = {
  executeKruskal,
  get cy() {
    return state.cy;
  }
};
