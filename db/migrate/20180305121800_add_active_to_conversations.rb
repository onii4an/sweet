class AddActiveToConversations < ActiveRecord::Migration[5.1]
  def change
    add_column :conversations, :active, :boolean, default: true
  end
end
