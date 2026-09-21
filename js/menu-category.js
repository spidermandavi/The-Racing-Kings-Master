(function(){
  function renderCategory(){
    const main=document.querySelector('[data-menu-category]');
    const grid=document.getElementById('categoryOptions');
    if(!main||!grid)return;
    const slug=main.dataset.menuCategory;
    const groups=(typeof RK_MENU_GROUPS!=='undefined'&&Array.isArray(RK_MENU_GROUPS))?RK_MENU_GROUPS:[];
    const group=groups.find(g=>g.slug===slug);
    if(!group){grid.innerHTML='<div class="category-status">This category could not be found.</div>';return;}
    grid.innerHTML=(group.items||[]).map(item=>{
      const href=String(item.slug||'')+'.html';
      const icon=item.icon||'•';
      const description=item.description||'';
      return '<a class="category-card" href="'+href+'"><span class="category-card-icon">'+icon+'</span><h2>'+item.label+'</h2><p>'+description+'</p><span class="category-card-arrow">→</span></a>';
    }).join('')||'<div class="category-status">No options have been added to this category yet.</div>';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderCategory,{once:true});else renderCategory();
})();
