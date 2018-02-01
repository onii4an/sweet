class AddUniqnessOfConversation < ActiveRecord::Migration[5.1]
  def change
    add_index :conversations, [:boy_id, :girl_id], unique: true
  end
end
