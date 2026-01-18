import React from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ExploreScreen() {
  const LAWYER_PHONE = "91XXXXXXXXXX"; // put lawyer number
  const LAWYER_EMAIL = "lawyer@gmail.com"; // put email

  const openDialer = async () => {
    const url = `tel:${LAWYER_PHONE}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) return Alert.alert("Error", "Calling not supported on this device.");
    Linking.openURL(url);
  };

  const openWhatsapp = async () => {
    const message = encodeURIComponent("Hi, I need legal help regarding an IPC/BNS issue.");
    const url = `whatsapp://send?phone=${LAWYER_PHONE}&text=${message}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) return Alert.alert("WhatsApp not installed");
    Linking.openURL(url);
  };

  const openEmail = async () => {
    const subject = encodeURIComponent("Legal Consultation Request");
    const body = encodeURIComponent("Hi,\n\nI need legal guidance regarding a case.\n\nThanks");
    const url = `mailto:${LAWYER_EMAIL}?subject=${subject}&body=${body}`;
    Linking.openURL(url);
  };

  const openGoogleMaps = async () => {
    const url = "https://www.google.com/maps/search/lawyer+near+me";
    Linking.openURL(url);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Explore</Text>

      {/* Contact Lawyer Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👨‍⚖️ Contact a Lawyer ----- Service currently unavailable ---------</Text>
        <Text style={styles.cardSubtitle}>
          Get legal help from a verified lawyer (call, WhatsApp, email).
        </Text>

        <TouchableOpacity style={styles.btn} onPress={openDialer}>
          <Text style={styles.btnText}>📞 Call Lawyer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={openWhatsapp}>
          <Text style={styles.btnText}>💬 WhatsApp Lawyer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={openEmail}>
          <Text style={styles.btnText}>✉️ Email Lawyer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={openGoogleMaps}>
          <Text style={[styles.btnText, styles.btnOutlineText]}>📍 Find Lawyer Near Me</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          ⚠️ Disclaimer: This app provides information only. For legal action, consult a lawyer.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#0b0b0b",
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  cardSubtitle: {
    color: "#cfcfcf",
    marginBottom: 16,
  },
  btn: {
    backgroundColor: "#1e90ff",
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  btnText: {
    color: "white",
    fontWeight: "700",
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#1e90ff",
  },
  btnOutlineText: {
    color: "#1e90ff",
  },
  disclaimer: {
    marginTop: 14,
    color: "#aaaaaa",
    fontSize: 12,
    lineHeight: 16,
  },
});
