(function(root){
  'use strict';
  const kindNames={damage:'Tấn công',ultimate:'Tấn công tối thượng',heal:'Hỗ trợ hồi phục',guard:'Bảo hộ',passive:'Nội tại'};
  const scaleNames={STR:'Sức mạnh',DEX:'Nhanh nhẹn',SPD:'Tốc độ',INT:'Trí tuệ',WIS:'Ý chí',CHA:'Khí chất'};
  const supportKinds=new Set(['heal','guard','passive']);
  const text=(value,fallback)=>{const valueText=String(value??'').trim();return valueText||fallback;};
  const finite=(value,fallback=0)=>{const number=Number(value);return Number.isFinite(number)?number:fallback;};
  const numberText=value=>Number.isInteger(value)?String(value):String(Number(value.toFixed(2)));
  function skillInfo(skill,context={}){
    const source=skill&&typeof skill==='object'?skill:{};
    const name=text(source.name||source.id,'Kỹ năng');
    const kind=text(source.kind,'damage');
    const type=text(source.type,'Không rõ');
    const power=finite(source.power,0);
    const scale=text(source.scale,'WIS');
    const skillDescription=text(source.description,'Chiêu thức này chưa có mô tả thêm.');
    const accuracy=source.accuracy!=null?`${numberText(finite(source.accuracy,0))}%`:supportKinds.has(kind)?'Không áp dụng':text(context.accuracyText,'65% đến 98% theo DEX và trạng thái');
    const costs=[];
    const mp=finite(source.mpCost,0),hp=finite(source.hpCostRatio,0),corruption=finite(source.corruptionCost,0);
    if(mp>0)costs.push(`${numberText(mp)} MP`);
    if(hp>0)costs.push(`${numberText(hp*100)}% HP`);
    if(corruption>0)costs.push(`${numberText(corruption)} Sa Đọa`);
    const target=source.target?text(source.target,'Kẻ địch hiện tại'):kind==='heal'?(context.actorRole==='hero'?'Bản thân và khế thú đang ra sân':'Bản thân'):kind==='guard'||kind==='passive'?'Bản thân':'Kẻ địch hiện tại';
    const duration=Math.max(1,Math.round(finite(context.statusTurns,2)));
    const effects=[];
    if(kind==='heal')effects.push(context.actorRole==='hero'?'Hồi 25% HP tối đa cho người dùng, hồi 25 HP cho khế thú đang ra sân.':'Hồi 25% HP tối đa cho người dùng.');
    else if(kind==='guard')effects.push(context.actorRole==='hero'?'Hồi 15 HP, giảm sát thương nhận trong lượt này.':'Hồi 15 HP.');
    else if(kind==='passive')effects.push('Hiệu ứng nội tại luôn có tác dụng.');
    else effects.push(`Gây sát thương theo ${text(scaleNames[scale],scale)} với sức mạnh ${numberText(power)}.`);
    if(source.status)effects.push(`Có thể gây trạng thái ${text(source.status,'bất lợi')} ${duration} lượt.`);
    const rows=[`Hệ: ${type}`,`Loại: ${text(kindNames[kind],kind)}`,`Sức mạnh: ${numberText(power)}`,`Độ chính xác: ${accuracy}`,`Tiêu hao: ${costs.length?costs.join(' + '):'Không tiêu hao'}`,`Mục tiêu: ${target}`];
    if(source.cooldown!=null)rows.push(`Hồi chiêu: ${text(source.cooldown,'Không rõ')}`);
    rows.push(`Hiệu ứng: ${effects.join(' ')}`,`Mô tả: ${skillDescription}`);
    return {name,kind,type,rows,effects,text:rows.join('\n')};
  }
  root.VTNSkillInfo={describe:skillInfo};
})(typeof window!=='undefined'?window:globalThis);
