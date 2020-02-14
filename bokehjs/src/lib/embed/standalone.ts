import {Document} from "../document"
import {DocumentChangedEvent, RootAddedEvent, RootRemovedEvent, TitleChangedEvent} from "../document"
import {HasProps} from "../core/has_props"
import {View} from "../core/view"
import {DOMView} from "../core/dom_view"
import {build_view} from "../core/build_views"
import {div} from "../core/dom"
import {BOKEH_ROOT} from "./dom"

// A map from the root model IDs to their views.
export const index: {[key: string]: View} = {}

export async function add_document_standalone(document: Document, element: HTMLElement,
    roots: {[key: string]: HTMLElement} = {}, use_for_title: boolean = false,
    root_ids: string[] = []): Promise<View[]> {
  // this is a LOCAL index of views used only by this particular rendering
  // call, so we can remove the views we create.
  const views: Map<HasProps, View> = new Map()

  async function render_model(model: HasProps, n: number): Promise<View> {
    let root_el: HTMLElement
    if ((n < root_ids.length) && (root_ids[n] in roots))
      root_el = roots[root_ids[n]]
    else if (model.id in roots)
      root_el = roots[model.id]
    else if (element.classList.contains(BOKEH_ROOT))
      root_el = element
    else {
      root_el = div({class: BOKEH_ROOT})
      element.appendChild(root_el)
    }

    const view = await build_view(model, {parent: null})
    if (view instanceof DOMView)
      view.renderTo(root_el)
    views.set(model, view)
    index[model.id] = view
    return view
  }

  function unrender_model(model: HasProps): void {
    const view = views.get(model)
    if (view != null) {
      view.remove()
      views.delete(model)
      delete index[model.id]
    }
  }

  const root_models = document.roots()
  for (let i = 0; i < root_models.length; i++)
    await render_model(root_models[i], i)

  if (use_for_title)
    window.document.title = document.title()

  document.on_change((event: DocumentChangedEvent): void => {
    if (event instanceof RootAddedEvent) {
      const n = document.roots().indexOf((event.model as any))
      render_model(event.model, n)
    } else if (event instanceof RootRemovedEvent)
      unrender_model(event.model)
    else if (use_for_title && event instanceof TitleChangedEvent)
      window.document.title = event.title
  })

  return [...views.values()]
}
