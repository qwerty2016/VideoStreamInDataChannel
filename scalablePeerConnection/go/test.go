package main

import "testing"

func TestGraph (t *testing.T) {
    graph := NewGraph()
    graph.AddNode("a")
    graph.AddNode("b")
    graph.AddNode("c")
    graph.AddNode("d")
    graph.AddNode("e")
    
    graph.AddUniEdge("a", "b", 1)
    graph.AddBiEdge("a", "c", 1)
    graph.AddUniEdge("a", "d", 1)
    graph.AddUniEdge("d", "c", 1)
    graph.AddUniEdge("b", "c", 1)
    graph.AddUniEdge("d", "e", 1)
    graph.AddUniEdge("c", "e", 1)
    
    graph.SetHead("a")
    h := graph.GetHead()
    a := graph.GetNode("b")
    
    if h.Value != a.Value {
	t.Errorf("Get head returns %q instead of %q", h.Value, a.Value)
    }
    
} 