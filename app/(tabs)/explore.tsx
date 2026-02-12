import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ExploreScreen() {
  const LAWYER_PHONE = "91XXXXXXXXXX"; // put lawyer number
  const LAWYER_EMAIL = "lawyer@gmail.com"; // put email
  const [menuOpen, setMenuOpen] = useState(false);
  const slideAnim = React.useMemo(() => new Animated.Value(0), []);

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

  const openMenu = () => {
    setMenuOpen(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (finished) setMenuOpen(false);
    });
  };

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-240, 0],
  });
  const overlayOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const LAWYERS = [
    {
      id: "lawyer1",
      name: "Lawyer 1",
      phone: "+91-XXXXXXXXXX",
      email: "lawyer1@example.com",
      location: "City Center",
    },
    {
      id: "lawyer2",
      name: "Lawyer 2",
      phone: "+91-XXXXXXXXXX",
      email: "lawyer2@example.com",
      location: "North District",
    },
    {
      id: "lawyer3",
      name: "Lawyer 3",
      phone: "+91-XXXXXXXXXX",
      email: "lawyer3@example.com",
      location: "South District",
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable
        style={styles.menuContainer}
        onHoverIn={openMenu}
      >
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => (menuOpen ? closeMenu() : openMenu())}
          accessibilityLabel="Open menu"
        >
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </TouchableOpacity>
      </Pressable>

      {menuOpen && (
        <Pressable style={styles.menuOverlay} onPress={closeMenu}>
          <Animated.View style={[styles.menuScrim, { opacity: overlayOpacity }]} />
          <Animated.View style={[styles.menuPanel, { transform: [{ translateX }] }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                router.push("/");
              }}
            >
              <Text style={styles.menuItemText}>Home</Text>
            </TouchableOpacity>
            <View style={styles.menuItem}>
              <Text style={[styles.menuItemText, styles.menuItemMuted]}>Contact a Lawyer</Text>
            </View>
          </Animated.View>
        </Pressable>
      )}

      <View style={styles.headerRow}>
        <Text style={styles.title}>Contact a Lawyer</Text>
        <TouchableOpacity style={styles.findButton} onPress={openGoogleMaps}>
          <Text style={styles.findButtonText}>📍 Find Near Me</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Available Lawyers (Prototype)</Text>
        <Text style={styles.cardSubtitle}>
          Profiles below are placeholders until verified data is available.
        </Text>

        <View style={styles.lawyerList}>
          {LAWYERS.map((lawyer) => (
            <View key={lawyer.id} style={styles.lawyerCard}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>👤</Text>
              </View>
              <View style={styles.lawyerInfo}>
                <Text style={styles.lawyerName}>{lawyer.name}</Text>
                <Text style={styles.lawyerDetail}>📞 {lawyer.phone}</Text>
                <Text style={styles.lawyerDetail}>✉️ {lawyer.email}</Text>
                <Text style={styles.lawyerDetail}>📍 {lawyer.location}</Text>
              </View>
              <View style={styles.lawyerActions}>
                <TouchableOpacity style={styles.actionButton} onPress={openDialer}>
                  <Text style={styles.actionButtonText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={openWhatsapp}>
                  <Text style={styles.actionButtonText}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButtonOutline} onPress={openEmail}>
                  <Text style={styles.actionButtonOutlineText}>Email</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

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
    paddingTop: 28,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  findButton: {
    backgroundColor: "#1e90ff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  findButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 12,
  },
  menuContainer: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
  },
  menuButton: {
    width: 42,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#141a2b",
    borderWidth: 1,
    borderColor: "#2b3558",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: "#f4f7ff",
  },
  menuPanel: {
    width: 220,
    height: "100%",
    paddingTop: 72,
    paddingHorizontal: 16,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: "#0b0b0b",
    borderWidth: 1,
    borderColor: "#2b3558",
    overflow: "hidden",
  },
  menuItem: {
    paddingVertical: 12,
  },
  menuItemText: {
    color: "#f4f7ff",
    fontSize: 14,
    fontWeight: "600",
  },
  menuItemMuted: {
    opacity: 0.7,
  },
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
  },
  menuScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 12, 24, 0.35)",
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
  lawyerList: {
    gap: 12,
    marginBottom: 12,
  },
  lawyerCard: {
    backgroundColor: "#141a2b",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#2b3558",
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1f2942",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
  },
  lawyerInfo: {
    flex: 1,
    gap: 4,
  },
  lawyerName: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
  lawyerDetail: {
    color: "#cfcfcf",
    fontSize: 12,
  },
  lawyerActions: {
    justifyContent: "center",
    gap: 6,
  },
  actionButton: {
    backgroundColor: "#1e90ff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 11,
  },
  actionButtonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#1e90ff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonOutlineText: {
    color: "#1e90ff",
    fontWeight: "700",
    fontSize: 11,
  },
  disclaimer: {
    marginTop: 14,
    color: "#aaaaaa",
    fontSize: 12,
    lineHeight: 16,
  },
});
