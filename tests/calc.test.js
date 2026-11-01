global.window={};require(require('path').resolve(__dirname,'../assets/js/calc.js'));const c=window.BrideCalc;
const it=(r,p,u)=>({required:r,purchased:p,unitPrice:u,status:'missing'});
let ok=true;const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b)){ok=false;console.log('FAIL',m,JSON.stringify(a),JSON.stringify(b))}};
// priced + unpriced + zero-price
const items=[it(2,1,100),it(3,0,null),it(1,1,0),it(0,0,null),it(4,2,0.1)];
const k=c.costs(items);
eq(k.requiredCost.total,200+0+0.4,'required');eq(k.requiredCost.unpricedCount,1,'unpriced req (qty0 item excluded)');
eq(k.purchasedCost.total,100+0+0.2,'purchased');eq(k.purchasedCost.incomplete,false,'purchased complete: unpriced bought none');
eq(k.remainingCost.unpricedCount,1,'remaining unpriced');
eq(c.costs([it(3,0,undefined)]).requiredCost.pricedCount,0,'no priced');
// float
eq(c.costs([it(3,3,0.1)]).requiredCost.total,0.3,'float rounding');
// category budget
let b=c.categoryBudget({budget:1000},[it(2,1,300),it(1,0,null)]);
eq([b.left,b.over,b.status,b.partial,b.unpricedCount,b.usedPercent,b.leftAfterPurchases],[400,false,'within',true,1,60,700],'cat within');
b=c.categoryBudget({budget:500},[it(2,2,300)]);eq([b.left,b.over,b.overBy,b.status,b.usedPercent],[-100,true,100,'over',120],'cat over');
b=c.categoryBudget({budget:0},[it(1,0,10)]);eq([b.over,b.usedPercent,b.status],[true,null,'over'],'zero budget with cost');
b=c.categoryBudget({budget:null},[it(1,0,10)]);eq([b.status,b.left],['unset',null],'unset');
b=c.categoryBudget({budget:0},[]);eq([b.status,b.over,b.isSet],['within',false,true],'zero budget keeps zero');
// overview
let o=c.overview(10000,[{budget:4000},{budget:3000},{budget:null}],[it(2,1,300),it(1,0,null)]);
eq([o.plan.allocated,o.plan.unallocated,o.requiredCost.total,o.purchasedCost.total,o.unpricedCount,o.partial,o.left,o.usedPercent,o.boughtPercent],[7000,3000,600,300,1,true,9400,6,3],'overview');
o=c.overview(null,[],[it(1,0,5)]);eq([o.hasGauge,o.left],[false,null],'no total');
o=c.overview(100,[],[it(1,0,500)]);eq([o.over,o.overBy],[true,400],'overview over (certain even if partial)');
console.log(ok?'CALC OK':'CALC FAILED');
