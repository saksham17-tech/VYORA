// Stage 9 — Community Hub with content reporting & safe DOM rendering
(function(){
 const list=document.getElementById('postList'),status=document.getElementById('postStatus');if(!list)return;
 function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 async function load(){
   list.replaceChildren();
   try{
     const [posts, me] = await Promise.all([VyoraAPI.listPosts(), VyoraAPI.me()]);
     if(!posts.length){
       list.append(el('p','bottom-note','No community posts yet. Be the first to share something useful.'));
       return;
     }
     for(const p of posts){
       const card=el('article','card post-card'),
             badge=el('span','post-badge',String(p.type).toUpperCase()),
             title=el('h3','',p.title),
             author=el('p','',`by ${p.author||'VYORA member'}`),
             body=el('p','',p.body),
             meta=el('p','post-meta',`${p.likes||0} likes · ${p.comments||0} comments`),
             actions=el('div','chat-row');
       actions.style.flexWrap='wrap';
       card.append(badge,title,author,body);
       if(p.mediaUrl){
         const a=el('a','','Open media ↗');
         a.href=p.mediaUrl;a.target='_blank';a.rel='noopener noreferrer';
         card.append(a);
       }
       actions.append(meta);
       const like=el('button','btn ghost',p.liked?'Liked ♥':'Like ♡');
       like.addEventListener('click',async()=>{try{await VyoraAPI.likePost(p.id);await load();}catch(e){status.textContent=e.message;}});
       actions.append(like);

       const comment=el('button','btn ghost','Comment');
       comment.addEventListener('click',async()=>{
         const bodyText=prompt('Write a comment');
         if(!bodyText?.trim())return;
         try{await VyoraAPI.commentPost(p.id,bodyText.trim());await load();}catch(e){status.textContent=e.message;}
       });
       actions.append(comment);

       const report=el('button','btn ghost','Report ⚑');
       report.addEventListener('click',async()=>{
         const reason=prompt('Report reason (e.g. medical misinformation, spam, harassment)');
         if(!reason?.trim())return;
         try{
           await VyoraAPI.reportPost(p.id,reason.trim(),'Reported via Community Hub');
           status.textContent='Post reported to moderators.';
         }catch(e){status.textContent=e.message;}
       });
       actions.append(report);

       if(p.userId===me.id){
         const remove=el('button','btn ghost','Delete');
         remove.addEventListener('click',async()=>{if(confirm('Delete this post?')){await VyoraAPI.deletePost(p.id);await load();}});
         actions.append(remove);
       }
       card.append(actions);
       list.append(card);
     }
   }catch(e){
     list.append(el('p','bottom-note','Community unavailable: '+e.message));
   }
 }
 document.getElementById('postPublish')?.addEventListener('click',async()=>{
   const title=document.getElementById('postTitle').value.trim(),
         body=document.getElementById('postBody').value.trim(),
         type=document.getElementById('postType').value,
         mediaUrl=document.getElementById('postMedia').value.trim();
   if(!title||!body){status.textContent='Enter a title and post content.';return;}
   try{
     await VyoraAPI.createPost({title,body,type,mediaUrl});
     document.getElementById('postTitle').value='';
     document.getElementById('postBody').value='';
     document.getElementById('postMedia').value='';
     status.textContent='Published.';
     await load();
   }catch(e){status.textContent=e.message;}
 });
 load();
})();
