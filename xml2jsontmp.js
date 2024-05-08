// Leaving this here for future use
const xml2json = require('xml2json');

const xml = `
<root>
	<item jid="ilnchat@conference.weather.im" name="ilnchat" />
<item jid="zhuchat@conference.weather.im" name="zhuchat" />
<item jid="rerchat@conference.weather.im" name="Record Event Reports (RER)" />
<item jid="ncrfcchat@conference.weather.im" name="ncrfcchat" />
<item jid="zmechat@conference.weather.im" name="zmechat" />
<item jid="ggwchat@conference.weather.im" name="ggwchat" />
<item jid="sewchat@conference.weather.im" name="sewchat" />
<item jid="ohxchat@conference.weather.im" name="ohxchat" />
<item jid="megchat@conference.weather.im" name="megchat" />
<item jid="mobchat@conference.weather.im" name="mobchat" />
<item jid="brochat@conference.weather.im" name="brochat" />
<item jid="mkx_madison_spotters@conference.weather.im" name="MKX madison storm spotters" />
<item jid="ddcchat@conference.weather.im" name="ddcchat" />
<item jid="zanchat@conference.weather.im" name="zanchat" />
<item jid="mflchat@conference.weather.im" name="mflchat" />
<item jid="michiganwxalerts@conference.weather.im" name="michiganwxalerts" />
<item jid="dvnchat@conference.weather.im" name="dvnchat" />
<item jid="gjtchat@conference.weather.im" name="gjtchat" />
<item jid="ztlchat@conference.weather.im" name="ztlchat" />
<item jid="skywarnstatewidechase@conference.weather.im" name="Skywarn Statewide Chase team" />
<item jid="lmkchat@conference.weather.im" name="lmkchat" />
<item jid="wws44fl@conference.weather.im" name="WWS Tampa Bay" />
<item jid="hatchat@conference.weather.im" name="hatchat" />
<item jid="fwdchat@conference.weather.im" name="fwdchat" />
<item jid="boichat@conference.weather.im" name="boichat" />
<item jid="crisfield-chat@conference.weather.im" name="crisfield-chat" />
<item jid="slcchat@conference.weather.im" name="slcchat" />
<item jid="zobchat@conference.weather.im" name="zobchat" />
<item jid="amachat@conference.weather.im" name="Amarillo, TX" />
<item jid="pqrchat@conference.weather.im" name="pqrchat" />
<item jid="gstweather@conference.weather.im" name="GST Weather" />
<item jid="tws_chat@conference.weather.im" name="tws_chat" />
<item jid="franklin_chat@conference.weather.im" name="Franklin VT Chatroom" />
<item jid="zidchat@conference.weather.im" name="zidchat" />
<item jid="cnrfcchat@conference.weather.im" name="cnrfcchat" />
<item jid="nhcchat@conference.weather.im" name="nhcchat" />
<item jid="mke-skywarn@conference.weather.im" name="MKE Skywarn" />
<item jid="tnwxdiscuss@conference.weather.im" name="TN Statewide Weather Discussion" />
<item jid="stochat@conference.weather.im" name="stochat" />
<item jid="jklchat@conference.weather.im" name="jklchat" />
<item jid="grrchat@conference.weather.im" name="grrchat" />
<item jid="hnxchat@conference.weather.im" name="hnxchat" />
<item jid="spcchat@conference.weather.im" name="Storm Prediction Center Chatroom" />
<item jid="lchchat@conference.weather.im" name="lchchat" />
<item jid="khws@conference.weather.im" name="Huffman Weather Service" />
<item jid="kcichat@conference.weather.im" name="kcichat" />
<item jid="zbwchat@conference.weather.im" name="zbwchat" />
<item jid="otxchat@conference.weather.im" name="otxchat" />
<item jid="kodster@conference.weather.im" name="kodster" />
<item jid="vefchat@conference.weather.im" name="vefchat" />
<item jid="pubchat@conference.weather.im" name="pubchat" />
<item jid="wxst@conference.weather.im" name="Nationwide Encoder Relay Program" />
<item jid="psrchat@conference.weather.im" name="psrchat" />
<item jid="sgxchat@conference.weather.im" name="sgxchat" />
<item jid="pbzchat@conference.weather.im" name="pbzchat" />
<item jid="reddit_weatherlab@conference.weather.im" name="reddit_weatherlab" />
<item jid="nalsw@conference.weather.im" name="nalsw" />
<item jid="ekachat@conference.weather.im" name="ekachat" />
<item jid="ilxchat@conference.weather.im" name="ilxchat" />
<item jid="jsjchat@conference.weather.im" name="jsjchat" />
<item jid="barnburnerwi@conference.weather.im" name="Barn Burner WI" />
<item jid="ohiostormspottersteamoss@conference.weather.im" name="Ohio storm Spotters Team oss" />
<item jid="mlbchat@conference.weather.im" name="mlbchat" />
<item jid="arxchat@conference.weather.im" name="arxchat" />
<item jid="ilmchat@conference.weather.im" name="ilmchat" />
<item jid="okxchat@conference.weather.im" name="okxchat" />
<item jid="botstalk@conference.weather.im" name="botstalk" />
<item jid="lknchat@conference.weather.im" name="lknchat" />
<item jid="siawx_chat@conference.weather.im" name="siawx_chat" />
<item jid="rahchat@conference.weather.im" name="rahchat" />
<item jid="afcchat@conference.weather.im" name="afcchat" />
<item jid="lotchat@conference.weather.im" name="lotchat" />
<item jid="n90@conference.weather.im" name="n90" />
<item jid="boxchat@conference.weather.im" name="boxchat" />
<item jid="znychat@conference.weather.im" name="znychat" />
<item jid="akqchat@conference.weather.im" name="akqchat" />
<item jid="nerfcchat@conference.weather.im" name="nerfcchat" />
<item jid="zkcchat@conference.weather.im" name="zkcchat" />
<item jid="bischat@conference.weather.im" name="bischat" />
<item jid="twcchat@conference.weather.im" name="twcchat" />
<item jid="lmrfcchat@conference.weather.im" name="lmrfcchat" />
<item jid="abrchat@conference.weather.im" name="abrchat" />
<item jid="mbrfcchat@conference.weather.im" name="mbrfcchat" />
<item jid="pihchat@conference.weather.im" name="pihchat" />
<item jid="zoachat@conference.weather.im" name="zoachat" />
<item jid="mtrchat@conference.weather.im" name="mtrchat" />
<item jid="sjuchat@conference.weather.im" name="sjuchat" />
<item jid="gidchat@conference.weather.im" name="gidchat" />
<item jid="zmpchat@conference.weather.im" name="zmpchat" />
<item jid="phichat@conference.weather.im" name="phichat" />
<item jid="pitchat@conference.weather.im" name="WWS Pittsburgh" />
<item jid="chschat@conference.weather.im" name="chschat" />
<item jid="ajkchat@conference.weather.im" name="ajkchat" />
<item jid="chachat@conference.weather.im" name="WWS Charlotte" />
<item jid="bmxchat@conference.weather.im" name="bmxchat" />
<item jid="lixchat@conference.weather.im" name="lixchat" />
<item jid="apxchat@conference.weather.im" name="apxchat" />
<item jid="hunchat@conference.weather.im" name="hunchat" />
<item jid="spcmobile2006@conference.weather.im" name="spcmobile2006" />
<item jid="zmachat@conference.weather.im" name="zmachat" />
<item jid="phl@conference.weather.im" name="PHL TRACON" />
<item jid="dtxchat@conference.weather.im" name="dtxchat" />
<item jid="wbkoweatherwatchers@conference.weather.im" name="wbkoweatherwatchers" />
<item jid="gumchat@conference.weather.im" name="gumchat" />
<item jid="gcwxchat@conference.weather.im" name="gcwxchat" />
<item jid="zzmkxchat@conference.weather.im" name="zzmkxchat" />
<item jid="dentcoeas@conference.weather.im" name="dentcoeas" />
<item jid="marfcchat@conference.weather.im" name="marfcchat" />
<item jid="easwtalk@conference.weather.im" name="easwtalk" />
<item jid="crpchat@conference.weather.im" name="crpchat" />
<item jid="gccc-nc-skywarn@conference.weather.im" name="GCCC NC Skywarn" />
<item jid="zjxchat@conference.weather.im" name="zjxchat" />
<item jid="shvchat@conference.weather.im" name="shvchat" />
<item jid="tbwchat@conference.weather.im" name="tbwchat" />
<item jid="cyschat@conference.weather.im" name="cyschat" />
<item jid="hfochat@conference.weather.im" name="hfochat" />
<item jid="dmxchat@conference.weather.im" name="Des Moines, IA" />
<item jid="mseas-weather-discussion@conference.weather.im" name="MSEAS-Weather-Discussion" />
<item jid="zsechat@conference.weather.im" name="zsechat" />
<item jid="revchat@conference.weather.im" name="revchat" />
<item jid="carchat@conference.weather.im" name="carchat" />
<item jid="msochat@conference.weather.im" name="msochat" />
<item jid="abc3340@conference.weather.im" name="abc3340" />
<item jid="keychat@conference.weather.im" name="keychat" />
<item jid="riwchat@conference.weather.im" name="riwchat" />
<item jid="awpwxchat@conference.weather.im" name="awpwxchat" />
<item jid="mhxchat@conference.weather.im" name="mhxchat" />
<item jid="caechat@conference.weather.im" name="caechat" />
<item jid="indchat@conference.weather.im" name="indchat" />
<item jid="dlhchat@conference.weather.im" name="dlhchat" />
<item jid="unrchat@conference.weather.im" name="unrchat" />
<item jid="wilchat@conference.weather.im" name="WWS Columbus/Wilmington" />
<item jid="okc_chatrooms@conference.weather.im" name="okc_chatrooms" />
<item jid="kdtxchat@conference.weather.im" name="kdtxchat" />
<item jid="zabchat@conference.weather.im" name="zabchat" />
<item jid="wnpchat@conference.weather.im" name="wnpchat" />
<item jid="zlcchat@conference.weather.im" name="zlcchat" />
<item jid="ffcchat@conference.weather.im" name="ffcchat" />
<item jid="epzchat@conference.weather.im" name="epzchat" />
<item jid="taechat@conference.weather.im" name="taechat" />
<item jid="fox6chat@conference.weather.im" name="fox6chat" />
<item jid="cbrfcchat@conference.weather.im" name="cbrfcchat" />
<item jid="wisconsin_storm_spotters@conference.weather.im" name="Wisconsin Storm Spotters" />
<item jid="tfxchat@conference.weather.im" name="tfxchat" />
<item jid="abqchat@conference.weather.im" name="abqchat" />
<item jid="nwrfcchat@conference.weather.im" name="nwrfcchat" />
<item jid="rlxchat@conference.weather.im" name="rlxchat" />
<item jid="ounchat@conference.weather.im" name="ounchat" />
<item jid="clechat@conference.weather.im" name="clechat" />
<item jid="loxchat@conference.weather.im" name="loxchat" />
<item jid="fsdchat@conference.weather.im" name="fsdchat" />
<item jid="bgmchat@conference.weather.im" name="bgmchat" />
<item jid="wgrfcchat@conference.weather.im" name="wgrfcchat" />
<item jid="ewxchat@conference.weather.im" name="ewxchat" />
<item jid="uswat@conference.weather.im" name="Uswat United States weather team" />
<item jid="iowawx@conference.weather.im" name="iowawx" />
<item jid="ohrfcchat@conference.weather.im" name="ohrfcchat" />
<item jid="serfcchat@conference.weather.im" name="serfcchat" />
<item jid="stichat@conference.weather.im" name="stichat" />
<item jid="zdvchat@conference.weather.im" name="zdvchat" />
<item jid="eaxchat@conference.weather.im" name="eaxchat" />
<item jid="iwxchat@conference.weather.im" name="iwxchat" />
<item jid="lubchat@conference.weather.im" name="lubchat" />
<item jid="whntweather@conference.weather.im" name="whntweather" />
<item jid="bufchat@conference.weather.im" name="bufchat" />
<item jid="pdtchat@conference.weather.im" name="pdtchat" />
<item jid="knsw@conference.weather.im" name="knsw" />
<item jid="mkxchat@conference.weather.im" name="mkxchat" />
<item jid="test@conference.weather.im" name="test" />
<item jid="abc3340skywatcher@conference.weather.im" name="abc3340skywatcher" />
<item jid="grbchat@conference.weather.im" name="grbchat" />
<item jid="topchat@conference.weather.im" name="topchat" />
<item jid="rnkchat@conference.weather.im" name="rnkchat" />
<item jid="lzkchat@conference.weather.im" name="lzkchat" />
<item jid="ctpchat@conference.weather.im" name="ctpchat" />
<item jid="gldchat@conference.weather.im" name="gldchat" />
<item jid="abrfcchat@conference.weather.im" name="abrfcchat" />
<item jid="byzchat@conference.weather.im" name="byzchat" />
<item jid="mpxchat@conference.weather.im" name="mpxchat" />
<item jid="zdcchat@conference.weather.im" name="zdcchat" />
<item jid="lsxchat@conference.weather.im" name="lsxchat" />
<item jid="pahchat@conference.weather.im" name="pahchat" />
<item jid="bouchat@conference.weather.im" name="Boulder, CO" />
<item jid="tsachat@conference.weather.im" name="tsachat" />
<item jid="bmxspotterchat@conference.weather.im" name="bmxspotterchat" />
<item jid="zfwchat@conference.weather.im" name="zfwchat" />
<item jid="zauchat@conference.weather.im" name="zauchat" />
<item jid="aprfcchat@conference.weather.im" name="aprfcchat" />
<item jid="wwsreport@conference.weather.im" name="WWS Report" />
<item jid="bmxalertchat@conference.weather.im" name="bmxalertchat" />
<item jid="mqtchat@conference.weather.im" name="mqtchat" />
<item jid="mafchat@conference.weather.im" name="mafchat" />
<item jid="mrxchat@conference.weather.im" name="mrxchat" />
<item jid="fgzchat@conference.weather.im" name="fgzchat" />
<item jid="twitter@conference.weather.im" name="twitter" />
<item jid="oaxchat@conference.weather.im" name="oaxchat" />
<item jid="btvchat@conference.weather.im" name="btvchat" />
<item jid="potomac_tracon@conference.weather.im" name="Potomac TRACON" />
<item jid="ictchat@conference.weather.im" name="ictchat" />
<item jid="mfrchat@conference.weather.im" name="mfrchat" />
<item jid="detroiteaschat@conference.weather.im" name="detroiteaschat" />
<item jid="hgxchat@conference.weather.im" name="hgxchat" />
<item jid="afgchat@conference.weather.im" name="afgchat" />
<item jid="sgfchat@conference.weather.im" name="sgfchat" />
<item jid="hawaii@conference.weather.im" name="Hawaii Weather" />
<item jid="cwest@conference.weather.im" name="CWEST" />
<item jid="zlachat@conference.weather.im" name="zlachat" />
<item jid="alychat@conference.weather.im" name="alychat" />
<item jid="sjtchat@conference.weather.im" name="sjtchat" />
<item jid="janchat@conference.weather.im" name="janchat" />
<item jid="gspchat@conference.weather.im" name="gspchat" />
<item jid="lwxchat@conference.weather.im" name="lwxchat" />
<item jid="gyxchat@conference.weather.im" name="gyxchat" />
<item jid="wpcchat@conference.weather.im" name="WPC Chatroom" />
<item jid="sweaseops1@conference.weather.im" name="sweaseops1" />
<item jid="scwx@conference.weather.im" name="South Carolina Weather" />
<item jid="lbfchat@conference.weather.im" name="lbfchat" />
<item jid="jaxchat@conference.weather.im" name="jaxchat" />
<item jid="nwsc@conference.weather.im" name="Nate's Weather Safety Center" />
<item jid="fgfchat@conference.weather.im" name="fgfchat" />
</root>
`;

const json = xml2json.toJson(xml, { object: true });

console.log(JSON.stringify(json, null, 2));
