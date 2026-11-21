import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/lib/api";

type Flight = {
  id: string; numero_voo?: string; origem?: string; destino?: string; matricula_registro?: string;
  data_agendada?: string; modelo?: string; status?: string;
};
type Leg = { id: string; numero: number; origem?: string; destino?: string; horario_ac?: string; horario_dep?: string; horario_pouso?: string; horario_corte?: string };
type Journey = { id: string; jornada_principal_id?: string | null; numero_jornada?: number; data?: string; funcao_tripulante?: string; status?: string; minutos_jornada?: number; pernas: Leg[] };
type Detail = { voo: Flight & { cliente_razao_social?: string; piloto_nome?: string; copiloto_nome?: string }; jornadas: Journey[] };
type Metrics = { horas_totais?: number; voos_escalados?: number };
const BG="#071323", CARD="#122238", BORDER="#263b55", BLUE="#27b9f5", MUTED="#a3b5ca";
const date=(d?:string)=>d?d.slice(0,10).split("-").reverse().join("/"):"—";
const time=(d?:string)=>d?d.match(/\d{2}:\d{2}/)?.[0]||"—":"—";

export default function RelatorioVooScreen() {
  const router=useRouter(),insets=useSafeAreaInsets();
  const [flights,setFlights]=useState<Flight[]>([]),[detail,setDetail]=useState<Detail|null>(null),[metrics,setMetrics]=useState<Metrics>({});
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState("");
  const load=useCallback(async(refresh=false)=>{
    if(refresh)setRefreshing(true);else setLoading(true);
    setError("");
    try{
      const [f,p]=await Promise.all([
        apiFetch<{voos:Flight[]}>("/api/colaborador/meus-voos"),
        apiFetch<{metricas:Metrics}>("/api/colaborador/perfil"),
      ]);
      setFlights(Array.isArray(f.voos)?f.voos:[]);
      setMetrics(p.metricas||{});
    }catch(e){setError(e instanceof Error?e.message:"Falha ao carregar voos.");}
    finally{setLoading(false);setRefreshing(false);}
  },[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const open=async(id:string)=>{
    setLoading(true);setError("");
    try{setDetail(await apiFetch<Detail>(`/api/colaborador/meus-voos/${encodeURIComponent(id)}`));}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível consultar o voo.");}
    finally{setLoading(false);}
  };
  const jornadas=detail?.jornadas?.filter(j=>!j.jornada_principal_id) || [];
  return <View style={[s.root,{paddingTop:insets.top+10}]}>
    <View style={s.header}><Pressable onPress={()=>detail?setDetail(null):router.back()} style={s.icon}><Feather name="arrow-left" size={21} color="#fff"/></Pressable><View style={{flex:1}}><Text style={s.kicker}>TRIP SHARE · OPERAÇÕES</Text><Text style={s.title}>{detail?"Voo registrado":"Meu histórico de voos"}</Text></View></View>
    {!!error&&<Pressable style={s.error} onPress={()=>void load(true)}><Text style={s.muted}>{error} · Atualizar</Text></Pressable>}
    {loading?<ActivityIndicator color={BLUE} style={{marginTop:35}}/>:<ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)} tintColor={BLUE}/>} contentContainerStyle={{padding:18,paddingBottom:insets.bottom+120}}>
      {!detail?<><View style={s.metrics}><View style={s.metric}><Text style={s.value}>{Number(metrics.horas_totais||0).toLocaleString("pt-BR")}</Text><Text style={s.muted}>Horas no diário</Text></View><View style={s.metric}><Text style={s.value}>{metrics.voos_escalados??"—"}</Text><Text style={s.muted}>Voos aprovados</Text></View></View>
        <Text style={s.section}>VOOS ATRIBUÍDOS · {flights.length}</Text>
        {flights.map(f=><Pressable key={f.id} style={s.card} onPress={()=>void open(f.id)}><View style={s.between}><Text style={s.flight}>{f.numero_voo||"Voo"}</Text><Text style={s.tag}>{f.status||"—"}</Text></View><Text style={s.route}>{f.origem||"—"} → {f.destino||"—"}</Text><Text style={s.muted}>{f.matricula_registro||"Aeronave"} · {date(f.data_agendada)}</Text><Text style={s.link}>Consultar jornadas e horários</Text></Pressable>)}
        {!flights.length&&<View style={s.card}><Text style={s.muted}>Não há voos atribuídos ao seu usuário.</Text></View>}
      </>:<>
        <View style={s.card}><View style={s.between}><Text style={s.flight}>{detail.voo.numero_voo}</Text><Text style={s.tag}>{detail.voo.status}</Text></View><Text style={s.route}>{detail.voo.origem} → {detail.voo.destino}</Text><Text style={s.muted}>{detail.voo.matricula_registro} · {date(detail.voo.data_agendada)}</Text><Text style={s.muted}>{detail.voo.cliente_razao_social || "Cliente não informado"}</Text></View>
        <Text style={s.section}>JORNADAS · {jornadas.length}</Text>
        {jornadas.map((j,i)=><View key={j.id} style={s.card}><Text style={s.flight}>Jornada {j.numero_jornada||i+1} · {date(j.data)}</Text><Text style={s.muted}>Status: {j.status||"—"}</Text>
          {(j.pernas||[]).map(leg=><View key={leg.id} style={s.leg}><Text style={s.label}>Perna {leg.numero}: {leg.origem} → {leg.destino}</Text><Text style={s.muted}>AC {time(leg.horario_ac)} · DEP {time(leg.horario_dep)} · POU {time(leg.horario_pouso)} · COR {time(leg.horario_corte)}</Text></View>)}
        </View>)}
        {!jornadas.length&&<View style={s.card}><Text style={s.muted}>Nenhuma jornada registrada neste voo.</Text></View>}
        <Pressable style={s.action} onPress={()=>router.push("/(tabs)/agenda")}><Feather name="edit-3" color={BG} size={18}/><Text style={s.actionText}>Abrir Agenda operacional</Text></Pressable>
      </>}
    </ScrollView>}
  </View>;
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:BG},header:{flexDirection:"row",alignItems:"center",gap:12,paddingHorizontal:18,paddingVertical:15},icon:{height:44,width:44,borderRadius:13,backgroundColor:CARD,alignItems:"center",justifyContent:"center"},
  kicker:{color:BLUE,fontSize:10,fontWeight:"800",letterSpacing:1.6},title:{fontSize:24,fontWeight:"800",color:"#fff",marginTop:4},
  card:{backgroundColor:CARD,borderColor:BORDER,borderWidth:1,borderRadius:17,padding:16,marginBottom:12},between:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12},
  flight:{fontSize:17,fontWeight:"800",color:"#fff"},tag:{color:"#98e3c8",fontSize:11,textTransform:"uppercase"},route:{color:"#fff",fontSize:22,fontWeight:"800",marginVertical:9},
  muted:{fontSize:12,color:MUTED,lineHeight:19,marginTop:5},section:{fontSize:11,fontWeight:"800",color:MUTED,letterSpacing:1.3,marginTop:16,marginBottom:12},
  metrics:{backgroundColor:"#133251",borderWidth:1,borderColor:"#2e6083",borderRadius:18,flexDirection:"row",padding:18,marginBottom:12},metric:{flex:1,alignItems:"center"},value:{fontSize:25,fontWeight:"800",color:"#fff"},
  link:{fontSize:13,color:BLUE,fontWeight:"700",marginTop:13},leg:{borderTopWidth:1,borderTopColor:BORDER,paddingTop:13,marginTop:13},label:{fontSize:14,fontWeight:"700",color:"#f4f8fd"},
  error:{backgroundColor:"#562735",borderRadius:12,marginHorizontal:17,padding:12},action:{minHeight:55,backgroundColor:BLUE,borderRadius:14,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:10,marginTop:10},actionText:{color:BG,fontSize:15,fontWeight:"800"},
});
