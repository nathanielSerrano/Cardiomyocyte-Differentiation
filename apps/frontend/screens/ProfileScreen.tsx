import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Switch,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserInfo, getPredictions, createProject, joinProject, leaveProject } from '../services/api';

interface ProfileScreenProps {
  token: string;
  onLogout: () => void;
}

export default function ProfileScreen({ token, onLogout }: ProfileScreenProps) {
  
  // Real Data States
  const [profile, setProfile] = useState<any>(null);
  const [totalAnalyses, setTotalAnalyses] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Local Storage States
  const [localName, setLocalName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  // Project Management States
  const [isProjectModalVisible, setProjectModalVisible] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [joinProjectId, setJoinProjectId] = useState("");

  const fetchRealData = async () => {
    try {
      const [userProfile, predictions, storedName] = await Promise.all([
        getUserInfo(token),
        getPredictions(token, 100),
        AsyncStorage.getItem('@display_name')
      ]);
      setProfile(userProfile);
      setTotalAnalyses(predictions ? predictions.length : 0);
      if (storedName) setLocalName(storedName);
    } catch (error) {
      console.error("Failed to load profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      if (isActive) fetchRealData();
      return () => { isActive = false; };
    }, [token])
  );

  const handleSaveName = async () => {
    try {
      const finalName = tempName.trim();
      await AsyncStorage.setItem('@display_name', finalName);
      setLocalName(finalName);
      setIsEditingName(false);
    } catch (error) {
      console.error("Failed to save local name", error);
    }
  };

  // --- Project API Handlers ---
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      setLoading(true);
      await createProject(token, newProjectName.trim());
      setNewProjectName("");
      await fetchRealData(); // Refresh UI
      Alert.alert("Success", "Project created successfully!");
    } catch (e: any) {
      Alert.alert("Error", "Could not create project. It may already exist.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinProject = async () => {
    const pId = parseInt(joinProjectId.trim());
    if (isNaN(pId)) return Alert.alert("Invalid ID", "Please enter a valid numeric ID.");
    try {
      setLoading(true);
      await joinProject(token, pId);
      setJoinProjectId("");
      await fetchRealData(); 
      Alert.alert("Success", "Joined project successfully!");
    } catch (e: any) {
      Alert.alert("Error", "Could not join project. Check the ID.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveProject = async (projectId: number, projectName: string) => {
    Alert.alert(
      "Leave Project",
      `Are you sure you want to leave '${projectName}'?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Leave", 
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await leaveProject(token, projectId);
              await fetchRealData();
            } catch (e) {
              Alert.alert("Error", "Could not leave project.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name[0].toUpperCase();
  };

  const displayTitle = localName || profile?.user || "MyoScope User";

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {loading && !isProjectModalVisible ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 60 }} />
        ) : (
          <>
            <View style={styles.headerSection}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{getInitials(displayTitle)}</Text>
              </View>

              {isEditingName ? (
                <View style={styles.editNameContainer}>
                  <TextInput
                    style={styles.nameInput}
                    value={tempName}
                    onChangeText={setTempName}
                    placeholder="Enter display name..."
                    autoFocus={true}
                    onSubmitEditing={handleSaveName}
                  />
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveName}>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.nameText}>{displayTitle}</Text>
                  <TouchableOpacity 
                    style={styles.editIcon} 
                    onPress={() => {
                      setTempName(displayTitle);
                      setIsEditingName(true);
                    }}
                  >
                    <Ionicons name="pencil" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.roleText}>@{profile?.user || "user"}</Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{totalAnalyses}</Text>
                <Text style={styles.statLabel}>Total Analyses</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{profile?.projects?.length || 0}</Text>
                <Text style={styles.statLabel}>Active Projects</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Lab Management</Text>

          {/* NEW: Project Management Button */}
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => setProjectModalVisible(true)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="folder-open-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.settingText}>Manage Projects</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>


        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>MyoScope v1.0.0</Text>
      </ScrollView>

      {/* --- PROJECT MANAGEMENT MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isProjectModalVisible}
        onRequestClose={() => setProjectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lab Projects</Text>
              <TouchableOpacity onPress={() => setProjectModalVisible(false)}>
                <Ionicons name="close" size={28} color="#111827" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Your Active Projects</Text>
            <ScrollView style={styles.projectList}>
              {profile?.projects?.length > 0 ? (
                profile.projects.map((p: any) => (
                  <View key={p.id} style={styles.projectCard}>
                    <View>
                      <Text style={styles.projectName}>{p.name}</Text>
                      <Text style={styles.projectId}>ID: {p.id}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleLeaveProject(p.id, p.name)}>
                      <Text style={styles.leaveText}>Leave</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>You are not in any projects.</Text>
              )}
            </ScrollView>

            <View style={styles.dividerHorizontal} />

            <Text style={styles.modalSubtitle}>Create or Join</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.modalInput}
                placeholder="New Project Name"
                value={newProjectName}
                onChangeText={setNewProjectName}
              />
              <TouchableOpacity style={styles.actionButton} onPress={handleCreateProject}>
                <Text style={styles.actionButtonText}>Create</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.modalInput}
                placeholder="Project ID (e.g. 1)"
                keyboardType="numeric"
                value={joinProjectId}
                onChangeText={setJoinProjectId}
              />
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#10B981' }]} onPress={handleJoinProject}>
                <Text style={styles.actionButtonText}>Join</Text>
              </TouchableOpacity>
            </View>
            
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  headerSection: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
  avatarContainer: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: '#FFFFFF' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  nameText: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  editIcon: { marginLeft: 8, padding: 4, backgroundColor: '#F3F4F6', borderRadius: 12 },
  editNameContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  nameInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, width: 200, color: '#111827' },
  saveButton: { marginLeft: 8, backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  saveButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  roleText: { fontSize: 16, fontWeight: '500', color: '#9CA3AF', marginBottom: 4 },
  statsContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 20, marginBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#2563EB', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#6B7280', textTransform: 'uppercase', fontWeight: '600' },
  divider: { width: 1, backgroundColor: '#E5E7EB' },
  sectionContainer: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  iconWrapper: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  settingText: { fontSize: 16, fontWeight: '500', color: '#111827' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 16, marginTop: 10, marginBottom: 20, borderWidth: 1, borderColor: '#FEE2E2' },
  logoutText: { fontSize: 16, fontWeight: 'bold', color: '#EF4444', marginLeft: 8 },
  versionText: { textAlign: 'center', fontSize: 12, color: '#D1D5DB' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  modalSubtitle: { fontSize: 14, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: 10, marginTop: 10 },
  projectList: { maxHeight: 200, marginBottom: 10 },
  projectCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  projectName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  projectId: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  leaveText: { color: '#EF4444', fontWeight: 'bold' },
  emptyText: { color: '#9CA3AF', fontStyle: 'italic' },
  dividerHorizontal: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  inputRow: { flexDirection: 'row', marginBottom: 12 },
  modalInput: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 16, color: '#111827', marginRight: 8 },
  actionButton: { backgroundColor: '#2563EB', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 8 },
  actionButtonText: { color: '#FFFFFF', fontWeight: 'bold' }
});